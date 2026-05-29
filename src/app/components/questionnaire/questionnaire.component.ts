import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, Params } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription, Observable, firstValueFrom } from 'rxjs';
import { SurveyService } from '../../services/survey.service';
import { SurveyQuestion, QuestionType } from '../../models/survey.types';
import {environment} from '../../../environments/environment'
import { LoadingSpinnerComponent } from '../loading-spinner/loading-spinner.component';

@Component({
    selector: 'app-questionnaire',
    standalone: true,
    imports: [CommonModule, FormsModule, LoadingSpinnerComponent],
    templateUrl: './questionnaire.component.html',
    styleUrls: ['./questionnaire.component.css']
})
export class QuestionnaireComponent implements OnInit, OnDestroy {
    // Survey State
    questions: SurveyQuestion[] = [];
    currentQuestion?: SurveyQuestion;
    questionKey: string = '';
    grpId: number = 0;
    token: string = '';
    supId: string = '';
    PID: string = '';
    surData: any = {};
    grpTrgtQuestions: any[] = [];
    targets: any[] = [];
    countryCode: string = 'US';
    keyForSaving: string = '';
    language: string = 'english';

    // Parity State
    rtlLangCheck: boolean = false;
    isStartHeading: boolean = false;
    selectedCheckboxes: number = 0;
    demographic: any = { selected_opt: '' }; // Unified text/single answers
    multiPunchSelection: { [key: string]: boolean } = {};
    previousSelectedOptionId: any;
    isRecaptcha: boolean = false;
    widgetId: any;
    existIds: string[] = [];

    // UI & Validation
    loading: boolean = true;
    onceClickNext: boolean = false;
    isNotValidDate: boolean = false;
    minDate: string = '';
    maxDate: string = '';
    
    // Progress & Navigation
    answeredCount: number = 0;
    currentQuestionNumber: number = 0;
    progressWidth: string = '0%';

    private routeSub?: Subscription;
    private querySub?: Subscription;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        public surveyService: SurveyService, // Made public for template access
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.querySub = this.route.queryParams.subscribe((params: Params) => {
            this.initializeSurvey(params);
        });
    }

    ngOnDestroy(): void {
        this.routeSub?.unsubscribe();
        this.querySub?.unsubscribe();
    }

    private html2txt(msg: string): string {
        return (msg || '').toLowerCase().replace(/#/g, 'hash').replace(/-/g, 'dash').replace(/&/g, 'and');
    }

    async initializeSurvey(params: Params): Promise<void> {
        this.loading = true;
        try {
            const encryptedSurvey = params['survey'];
            this.supId = params['supId'] || '';
            this.PID = params['pid'] || 'Test';
            const isTest = params['isTest'] === '1';

            // RTL & Heading logic
            this.language = params['Lang'] || 'english';
            const rtlLangs = ['arabic', 'urdu', 'hebrew', 'persian', 'farsi', 'yiddish', 'syriac', 'pashto', 'sindhi'];
            this.rtlLangCheck = rtlLangs.includes(this.language.toLowerCase());
            this.isStartHeading = !!params['start'];
            this.existIds = (params['existIds'] || '').split(',').filter((id: string) => id);

            // 1. Decrypt Data
            const grpData = await firstValueFrom(this.surveyService.getDecryptedSurvNum(encryptedSurvey));
            this.grpId = parseInt(grpData.decText[0]);
            this.keyForSaving = `${this.grpId}_${this.PID}`;

            if (params['uid']) {
                const uidData = await firstValueFrom(this.surveyService.getDecryptedUID(params['uid']));
                this.token = uidData.decText;
            }

            // 2. Fetch Details
            console.log('[Init] Fetching survey details for grpId:', this.grpId, 'supId:', this.supId);
            const detailsData = await firstValueFrom(this.surveyService.getSurveyDetails(this.grpId, this.supId));
            this.surData = JSON.parse(this.surveyService.decodeBase64(detailsData.surveyDetail));
            this.countryCode = this.surData.cntCode || 'US';

            // Additional scan of survey metadata for RTL characters
            const checkRtlText = (text: string) => {
                const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF\uFB1D-\uFB4F]/;
                return rtlRegex.test(text);
            };
            if (this.surData.srvy_msg_para && checkRtlText(this.surData.srvy_msg_para)) {
                this.rtlLangCheck = true;
            }

            // 3. Security: Research Defender
            if (!isTest && this.surData.resrchDfdChk === 1) {
                await this.surveyService.researchDfdFunction(this.token, this.grpId, this.supId, this.surData, this.PID);
            }

            // Verisoul
            if (!isTest && this.surData.verisoulCheck === 1 && (environment as any).verisoul?.enabled) {
                const runVerisoulFlow = async () => {
                    try {
                        await this.surveyService.verisoulFunction(this.token, this.grpId, this.supId, this.surData);
                    } catch (error) {
                        console.error('Error in Verisoul function:', error);
                        this.router.navigate(['access-denied']);
                        throw error;
                    }
                };

                const v = (environment as any).verisoul;
                if (!document.querySelector('script[verisoul-project-id]')) {
                    await new Promise<void>((resolve, reject) => {
                        const el = document.createElement('script');
                        el.async = true;
                        el.src = v.subdomain + v.env + "/bundle.js";
                        el.setAttribute('verisoul-project-id', v.projectId);
                        el.onload = () => {
                            runVerisoulFlow().then(resolve).catch(reject);
                        };
                        el.onerror = () => {
                            console.error("Failed to load Verisoul SDK");
                            this.router.navigate(['access-denied']);
                            reject('Verisoul SDK Load Error');
                        };
                        document.head.appendChild(el);
                    });
                } else {
                    await runVerisoulFlow();
                }
            }

            // 4. Screener Bypass - early exit to final step
            const hasBypass = Boolean(this.surData?.screenerBypass || this.surData?.supObj?.['sup' + this.supId]?.screenerBypass);
            if (hasBypass) {
                console.log('[Questionnaire] Screener bypass triggered. Checking global bypass settings...');
                this.surveyService.getBypassdata().subscribe({
                    next: (data) => {
                        const isGlobalBypass = data.bypass; // True means show instructions page, False means redirect immediately
                        if (!isGlobalBypass) {
                            console.log('[Questionnaire] Global bypass is false. Redirecting to supplier immediately.');
                            const snapshotParams = this.route.snapshot.queryParams;
                            let queryStrings = this.surveyService.serialize(snapshotParams);
                            queryStrings = this.surveyService.replaceAgeGender(queryStrings, this.keyForSaving);

                            if (snapshotParams['isTest'] === '1') {
                                this.surveyService.getSupplierTestUrl(queryStrings).subscribe(d => {
                                    if (d?.supplierTestUrl) window.location.href = d.supplierTestUrl;
                                    else this.closeSurvey('1');
                                });
                            } else {
                                const ctx = { token: this.token, jb_id: this.surData.prj_id, supCode: this.supId, grp_id: this.grpId, PID: this.PID };
                                this.surveyService.redirectToSupplierURL(queryStrings, this.router, ctx).subscribe();
                            }
                        } else {
                            console.log('[Questionnaire] Global bypass is true. Navigating to final page.');
                            this.nextFinal();
                        }
                    },
                    error: (err) => {
                        console.error('[Questionnaire] Failed to fetch global bypass setting. Defaulting to nextFinal:', err);
                        this.nextFinal();
                    }
                });
                return;
            }

            // 5. Transaction & Device ID
            if (this.token && !isTest) {
                const transData = await firstValueFrom(this.surveyService.getTransaction(this.token));
                const jobTrans = JSON.parse(this.surveyService.decodeBase64(transData.jobTrans));
                if (jobTrans.is_cmp) return this.closeSurvey('2');
                if (this.PID.toString() !== jobTrans.mbr_id?.toString()) return this.closeSurvey('3');
                // Store RVID if available
                if (jobTrans.RIDResp?.RVid) (window as any).RVID = jobTrans.RIDResp.RVid;
            }

            // 6. Quota & Target Metadata
            const targetStats = await firstValueFrom(this.surveyService.getTargetStats(this.grpId));
            this.targets = JSON.parse(this.surveyService.decodeBase64(targetStats.targets));
            const trgData = await firstValueFrom(this.surveyService.getSurveyTrgtQuestions(this.grpId));
            this.grpTrgtQuestions = JSON.parse(this.surveyService.decodeBase64(trgData.surTrgtQuestions));

            // 7. Load Questions
            const qIds = this.grpTrgtQuestions.map(q => q.q_id);
            const rawQuestions = await firstValueFrom(this.surveyService.getTargettingQuestions({ id: qIds, language: this.language.toUpperCase() }, 100, { seq: 1 }));
            this.questions = JSON.parse(this.surveyService.decodeBase64(rawQuestions.question));
            
            // Scan loaded questions text for RTL characters
            if (this.questions && this.questions.length > 0) {
                const sampleText = this.questions[0].questionText || '';
                if (checkRtlText(sampleText)) {
                    this.rtlLangCheck = true;
                }
            }
            
            // Display Order Manipulation
            this.questions.forEach((value: any) => {
                if (value.questionOptions && value.questionOptions.length) {
                    value.questionOptions.sort((a: any, b: any) => a.optSeq - b.optSeq);
                }
                if (value.displayOrder == 2) {
                    for (let i = value.questionOptions.length - 1; i > 0; i--) {
                        if (!value.questionOptions[i].islock) {
                            let j = Math.floor(Math.random() * (i + 1));
                            if (!value.questionOptions[j].islock) {
                                let temp = value.questionOptions[i];
                                value.questionOptions[i] = value.questionOptions[j];
                                value.questionOptions[j] = temp;
                            }
                        }
                    }
                }
                if (value.displayOrder == 1) {
                    for (let i = 0; i < value.questionOptions.length; i++) {
                        if (!value.questionOptions[i].islock) {
                            for (let j = i + 1; j < value.questionOptions.length; j++) {
                                if (!value.questionOptions[j].islock && (value.questionOptions[i].optText > value.questionOptions[j].optText)) {
                                    let temp = value.questionOptions[i];
                                    value.questionOptions[i] = value.questionOptions[j];
                                    value.questionOptions[j] = temp;
                                }
                            }
                        }
                    }
                }
                if (!value.hasOwnProperty("displayOrder") && value.questionOptions && value.questionOptions.length) {
                    value.questionOptions.sort((a: any, b: any) => a.id - b.id);
                }
            });

            // Update progress and question number
            this.updateProgress();
            this.updateCurrentQuestionNumber();

            this.setupDateConstraints();

            // 8. Handle Routing
            console.log('Subscribing to route params...');
            this.routeSub = this.route.params.subscribe((p: Params) => {
                const rawKey = p['questionKey'];
                console.log('Route param questionKey:', rawKey);
                if (rawKey) {
                    this.questionKey = rawKey;
                    this.currentQuestion = this.questions.find(q => {
                        // The backend might return 'QuestionKey' or 'questionKey' depending on mapping, try both:
                        const keyToMatch = (q as any).QuestionKey || q.questionKey;
                        const matched = this.html2txt(keyToMatch) === rawKey.toLowerCase();
                        if (matched) console.log('Found matching question for:', rawKey, q);
                        return matched;
                    });

                    if (!this.currentQuestion) {
                        console.warn('Could not find question matching route key:', rawKey);
                        console.log('First question in array is:', this.questions[0]);
                    }

                    this.recoverAnswer();
                    this.updateCurrentQuestionNumber();
                    this.loading = false;
                    this.cdr.detectChanges(); // Force UI update
                    this.trackGA();
                } else if (this.questions.length > 0) {
                    // Try both QuestionKey and questionKey
                    const keyToUse = (this.questions[0] as any).QuestionKey || this.questions[0].questionKey;
                    const firstKey = this.html2txt(keyToUse);
                    console.log('Navigating to first question:', firstKey);
                    this.router.navigate(['screenersurvey', firstKey], { queryParamsHandling: 'preserve' });
                } else {
                    console.error('No questions loaded from backend');
                }
            });

        } catch (error) {
            console.error('Init Error', error);
            this.closeSurvey('0');
        }
    }

    recoverAnswer(): void {
        const saved = this.surveyService.getSavedAnswers(this.keyForSaving);
        const ans = saved[this.currentQuestion?.questionKey || ''];
        if (ans) {
            if (this.currentQuestion?.questionType === QuestionType.MULTI_PUNCH) {
                this.multiPunchSelection = {};
                (ans.answer || '').toString().split(',').forEach((id: string) => this.multiPunchSelection[id] = true);
                this.updateCheckboxCounter();
            } else {
                this.demographic.selected_opt = ans.answer;
            }
        }
    }

    cbClicks(option: any): void {
        if (!this.currentQuestion) return;
        const all = this.currentQuestion.questionOptions || [];

        if (option.isExclusive) {
            Object.keys(this.multiPunchSelection).forEach(k => k !== option.id.toString() && (this.multiPunchSelection[k] = false));
        } else {
            all.forEach(o => o.isExclusive && (this.multiPunchSelection[o.id] = false));
        }

        const id = option.id.toString();
        this.multiPunchSelection[id] = !this.multiPunchSelection[id];

        // selectOnlyOpt logic
        const prevSelectOnly = all.find(o => o.selectOnlyOpt === 1 && o.id.toString() === this.previousSelectedOptionId?.toString());
        if (option.selectOnlyOpt === 1 && !prevSelectOnly) {
            all.forEach(o => o.id !== option.id && (this.multiPunchSelection[o.id] = false));
        } else if (all.some(o => o.selectOnlyOpt === 1 && this.multiPunchSelection[o.id.toString()])) {
            this.multiPunchSelection[id] = false;
        }

        this.previousSelectedOptionId = id;
        this.updateCheckboxCounter();
    }

    updateCheckboxCounter(): void {
        this.selectedCheckboxes = Object.values(this.multiPunchSelection).filter(v => v).length;
    }

    async onNext(): Promise<void> {
        if (!this.currentQuestion || this.onceClickNext) return;

        let answer = this.demographic.selected_opt;
        let option_id = answer;
        let selctdOptText = '';

        if (this.currentQuestion.questionType === QuestionType.MULTI_PUNCH) {
            answer = Object.keys(this.multiPunchSelection).filter(k => this.multiPunchSelection[k]);
            option_id = answer;
            selctdOptText = this.currentQuestion.questionOptions?.filter(o => answer.includes(o.id.toString())).map(o => o.optText).join(',') || '';
        } else if (this.currentQuestion.questionType === QuestionType.SINGLE_PUNCH) {
            const opt = this.currentQuestion.questionOptions?.find(o => o.id.toString() === answer.toString());
            selctdOptText = opt ? opt.optText : '';
        }

        if (this.currentQuestion.questionKey === 'BIRTH_DATE' || this.currentQuestion.id === environment.dobQuesId) {
            this.validateDate();
            if (this.isNotValidDate) return;
        }

        this.onceClickNext = true;

        // Quota check
        let isOverQuota = false;
        const trg = this.targets[0]?.[this.currentQuestion.questionKey];
        if (trg) {
            const age = parseInt(answer);
            const match = trg.opts.find((o: any) => (this.currentQuestion?.questionKey === 'AGE') ? (age >= o.startAge && age <= o.endAge) : (o.opt_id == option_id));
            if (match && parseInt(match.cmps) >= parseInt(match.N)) isOverQuota = true;
        }

        const isTerminate = this.surveyService.checkTermination(this.currentQuestion.id, this.currentQuestion.questionType, this.grpTrgtQuestions, answer, this.countryCode);
        await this.handleTermination(isTerminate, isOverQuota, answer, option_id, selctdOptText);
    }

    async handleTermination(isTerminate: boolean, isOverQuota: boolean, answer: any, option_id: any, selctdOptText: any): Promise<void> {
        const effectivelyTerminate = isTerminate || isOverQuota;

        // Save Choice
        const temp = {
            question_id: this.currentQuestion?.id,
            question_type: this.currentQuestion?.questionType,
            option_id: Array.isArray(option_id) ? option_id.join(',') : option_id,
            question_key: this.currentQuestion?.questionKey,
            answer: Array.isArray(answer) ? answer.join(',') : answer,
            terminate: effectivelyTerminate,
            question_text: this.currentQuestion?.questionText,
            option_text: selctdOptText
        };
        this.surveyService.saveChoicesTemporarily(temp, this.keyForSaving, this.currentQuestion?.questionKey || '');

        if (effectivelyTerminate) {
            const msgId = isOverQuota ? '5' : '1';
            const snapshotParams = this.route.snapshot.queryParams;
            const params: Params = { ...snapshotParams, message: msgId, isTestTerminate: snapshotParams['isTest'] === '1' };

            if (params['isTest'] === '1') {
                this.surveyService.getSupplierTestUrl(this.surveyService.serialize(params)).subscribe(d => {
                    this.closeSurvey(msgId);
                    if (d?.supplierTestUrl) setTimeout(() => window.location.href = d.supplierTestUrl, 2000);
                });
            } else {
                const body = { S: 5, token: this.token, reason: effectivelyTerminate ? 'Disqualified' : 'OverQuota', jobId: this.surData.prj_id, supCode: this.supId, surId: this.grpId, PID: this.PID, isFraud: 0 };
                this.surveyService.preSurveyTerminationInQA(body).subscribe(d => {
                    this.closeSurvey(msgId);
                    if (d?.url) setTimeout(() => window.location.href = d.url, 2000);
                });
            }
        } else {
            const saved = this.surveyService.getSavedAnswers(this.keyForSaving);

            const unanswered = this.questions.find(q => {
                const key = (q as any).QuestionKey || q.questionKey;
                const isAnswered = !!saved[key];
                const isExists = this.existIds.includes(q.id.toString());
                return !isAnswered && !isExists;
            });

            if (unanswered) {
                const nextKey = (unanswered as any).QuestionKey || unanswered.questionKey;
                this.router.navigate(['screenersurvey', this.html2txt(nextKey)], { queryParamsHandling: 'preserve' });
                this.resetForm();
                this.updateProgress();
                this.updateCurrentQuestionNumber();
            } else {
                this.nextFinal();
            }
        }
    }

    private resetForm(): void {
        this.onceClickNext = false;
        this.demographic.selected_opt = '';
        this.multiPunchSelection = {};
        this.selectedCheckboxes = 0;
    }

    async nextFinal(): Promise<void> {
        const saved = this.surveyService.getSavedAnswers(this.keyForSaving);

        // **URL Manipulation Check** (PSQT)
        const allAnswered = this.questions.every(q => {
            const key = (q as any).QuestionKey || q.questionKey;
            const isAnswered = !!saved[key];
            const isExists = this.existIds.includes(q.id.toString());
            if (!isAnswered && !isExists) {
                console.warn(`[NextFinal - URLCheck] Question "${key}" (ID: ${q.id}) not answered and not in existIds`);
            }
            return isAnswered || isExists;
        });
        
        console.log('[NextFinal - URLCheck] All answered check result:', allAnswered);
        const hasBypass = Boolean(this.surData?.screenerBypass || this.surData?.supObj?.['sup' + this.supId]?.screenerBypass);
        console.log('[NextFinal - URLCheck] Bypass check enabled:', hasBypass);

        if (!allAnswered && !hasBypass) {
            console.error('[NextFinal - URLCheck] URL Manipulation Check Failed! Terminating...');
            const body = { S: 8, token: this.token, reason: "URL Manipulation", jobId: this.surData.prj_id, supCode: this.supId, surId: this.grpId, PID: this.PID, isFraud: 0 };
            this.surveyService.preSurveyTerminationInQA(body).subscribe(d => {
                if (d?.url) window.location.href = d.url;
                else this.closeSurvey('1');
            });
            return;
        }
        console.log('[NextFinal - URLCheck] URL Manipulation Check Passed. Proceeding...');

        const snapshotParams = this.route.snapshot.queryParams;
        let queryStrings = this.surveyService.serialize(snapshotParams);

        // 1. Age/Gender Replacement
        queryStrings = this.surveyService.replaceAgeGender(queryStrings, this.keyForSaving);

        if (snapshotParams['isTest'] === '1') {
            this.surveyService.getSupplierTestUrl(queryStrings).subscribe(d => {
                if (d.supplierTestUrl) window.location.href = d.supplierTestUrl;
                else this.closeSurvey('1');
            });
            return;
        }

        const usersChoicesArr = Object.values(saved);

        const proceedToRedirect = () => {
            this.surveyService.getBypassdata().subscribe({
                next: (data) => {
                    const isGlobalBypass = data.bypass;
                    if (!isGlobalBypass) {
                        console.log('[Questionnaire - nextFinal] Global bypass is false. Redirecting immediately.');
                        if (this.surData.cid === environment.dynataCustId) {
                            const base = {
                                usr_Choices: usersChoicesArr,
                                PID: this.PID,
                                supCode: this.supId,
                                tr_id: this.token,
                                cnt: this.countryCode,
                                surData: this.surData,
                                lang: (snapshotParams['Lang'] || 'ENGLISH').toUpperCase()
                            };
                            const encoded = { encodedData: this.surveyService.encryptDataBase64(JSON.stringify(base)) };
                            this.surveyService.getDySur(encoded).subscribe(d => {
                                if (d.redirect) window.location.href = d.url;
                                else this.finalRedirect(queryStrings);
                            });
                        } else if (this.surData.cid === environment.psCustId) {
                            const base = {
                                usr_Choices: usersChoicesArr,
                                PID: this.PID,
                                supCode: this.supId,
                                tr_id: this.token,
                                cnt: this.countryCode,
                                surData: this.surData,
                                lang: (snapshotParams['Lang'] || 'ENGLISH').toUpperCase()
                            };
                            const encoded = { encodedData: this.surveyService.encryptDataBase64(JSON.stringify(base)) };
                            this.surveyService.getPSFusionSur({ ...encoded, mid: snapshotParams['mid'] }).subscribe(d => {
                                if (d.redirect) window.location.href = d.url;
                                else this.finalRedirect(queryStrings);
                            });
                        } else {
                            this.finalRedirect(queryStrings);
                        }
                    } else {
                        console.log('[Questionnaire - nextFinal] Global bypass is true. Navigating to final page.');
                        this.navigateToSurveyFinal(queryStrings);
                    }
                },
                error: (err) => {
                    console.error('[Questionnaire - nextFinal] Error fetching bypass data, navigating to final page:', err);
                    this.navigateToSurveyFinal(queryStrings);
                }
            });
        };

        if (usersChoicesArr.length > 0) {
            const panelistUserObj = {
                sur_data: usersChoicesArr,
                sur_id: this.grpId,
                PID: this.PID,
                supCode: this.supId,
                tr_id: this.token,
                isTerminate: false,
                cnt: this.countryCode,
                lang: (snapshotParams['Lang'] || 'ENGLISH').toUpperCase(),
                deviceId: (window as any).RVID || ''
            };

            this.surveyService.updateAllTargetData(panelistUserObj).subscribe(() => {
                this.surveyService.deleteKeyLocalStorageSavedAnswers(this.keyForSaving);
                this.syncProfiling();
                proceedToRedirect();
            });
        } else {
            // Special Case: Inbox Supplier (Device ID)
            if (this.supId === environment.inboxSupId) {
                this.surveyService.getTransaction(this.token).subscribe(trans => {
                    const jobTrans = JSON.parse(this.surveyService.decodeBase64(trans.jobTrans));
                    const rvid = jobTrans.RIDResp?.RVid;
                    if (rvid) {
                        const panelistUserObj = { PID: this.PID, supCode: this.supId, grp_id: this.grpId, tr_id: this.token, deviceId: rvid };
                        this.surveyService.updateAllTargetData(panelistUserObj).subscribe(() => proceedToRedirect());
                    } else {
                        proceedToRedirect();
                    }
                });
            } else {
                proceedToRedirect();
            }
        }
    }

    /** Store redirect data in the service and navigate to the instructions (survey-final) page. */
    private navigateToSurveyFinal(queryStrings: string): void {
        // Persist all context so SurveyFinalComponent can complete the redirect on button click.
        console.log('[NavigateToSurveyFinal] Saving context and navigating to survey-final component...');
        console.log('[NavigateToSurveyFinal] queryStrings:', queryStrings);
        console.log('[NavigateToSurveyFinal] surData:', this.surData);
        this.surveyService.pendingFinalRedirect = {
            queryStrings,
            surData: this.surData,
            cid: this.surData.cid,
            token: this.token,
            supId: this.supId,
            grpId: this.grpId,
            PID: this.PID,
            countryCode: this.countryCode,
            isRecaptcha: this.isRecaptcha
        };
        console.log('[NavigateToSurveyFinal] pendingFinalRedirect saved:', this.surveyService.pendingFinalRedirect);
        console.log('[Survey] All questions answered – navigating to instructions (survey-final).');
        this.router.navigate(['screenersurvey', 'final'], { queryParamsHandling: 'preserve' });
    }

    /** Called by SurveyFinalComponent via the service after the user clicks "Let's Do It". */
    handleRedirectionFlow(queryStrings: string): void {
        const saved = this.surveyService.getSavedAnswers(this.keyForSaving);
        const base = {
            usr_Choices: Object.values(saved),
            PID: this.PID,
            supCode: this.supId,
            tr_id: this.token,
            cnt: this.countryCode,
            surData: this.surData,
            lang: (this.route.snapshot.queryParams['Lang'] || 'ENGLISH').toUpperCase()
        };

        const encoded = { encodedData: this.surveyService.encryptDataBase64(JSON.stringify(base)) };

        if (this.surData.cid === environment.dynataCustId) {
            this.surveyService.getDySur(encoded).subscribe(d => d.redirect ? (window.location.href = d.url) : this.sendRecaptcha(queryStrings));
        } else if (this.surData.cid === environment.psCustId) {
            this.surveyService.getPSFusionSur({ ...encoded, mid: this.route.snapshot.queryParams['mid'] }).subscribe(d => d.redirect ? (window.location.href = d.url) : this.sendRecaptcha(queryStrings));
        } else {
            this.sendRecaptcha(queryStrings);
        }
    }

    sendRecaptcha(queryStrings: string): void {
        const skip = this.countryCode === 'CN' || !this.isRecaptcha;
        if (skip) this.finalRedirect(queryStrings);
        else console.log('Recaptcha needed');
    }

    finalRedirect(queryStrings: string): void {
        const ctx = { token: this.token, jb_id: this.surData.prj_id, supCode: this.supId, grp_id: this.grpId, PID: this.PID };
        this.surveyService.redirectToSupplierURL(queryStrings, this.router, ctx).subscribe();
    }

    syncProfiling(): void {
        const body = { grp_id: this.grpId, PID: this.PID, supCode: this.supId, tr_id: this.token };
        this.surveyService.syncProfilingQusWithPanel(body).subscribe();
    }

    setupDateConstraints(): void {
        const cfg = environment.dynataMinAge.find((it: any) => it.cntCode === this.countryCode) || { minAge: 18 };
        const now = new Date();
        this.maxDate = new Date(now.getFullYear() - cfg.minAge, now.getMonth(), now.getDate() + 1).toISOString().split('T')[0];
        this.minDate = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate()).toISOString().split('T')[0];
    }

    validateDate(): void {
        const d = new Date(this.demographic.selected_opt);
        this.isNotValidDate = isNaN(d.getTime()) || d < new Date(this.minDate) || d > new Date(this.maxDate);
    }

    trackGA(): void {
        if (typeof (window as any).gtag === 'function') {
            (window as any).gtag('config', environment.GA_TRACKING_ID, { 'page_path': this.router.url });
        }
    }

    private closeSurvey(msgId: string): void {
        this.router.navigate(['screenersurvey', 'closed'], { 
            queryParams: { ...this.route.snapshot.queryParams, message: msgId } 
        });
    }

    // Progress and Navigation Helper Methods
    updateProgress(): void {
        if (!this.questions.length) {
            this.progressWidth = '0%';
            this.answeredCount = 0;
            return;
        }
        const saved = this.surveyService.getSavedAnswers(this.keyForSaving);
        this.answeredCount = Object.keys(saved).length;
        const percentage = (this.answeredCount / this.questions.length) * 100;
        this.progressWidth = percentage + '%';
    }

    updateCurrentQuestionNumber(): void {
        if (!this.currentQuestion || !this.questions.length) {
            this.currentQuestionNumber = 0;
            return;
        }
        const currentKey = (this.currentQuestion as any).questionKey || this.currentQuestion.questionKey;
        const index = this.questions.findIndex(q => {
            const key = (q as any).questionKey || q.questionKey;
            return key === currentKey;
        });
        this.currentQuestionNumber = index + 1;
    }

    isNextDisabled(): boolean {
        if (this.onceClickNext) return true;
        if (this.currentQuestion?.questionType === 1 && this.selectedCheckboxes === 0) return true;
        if (this.currentQuestion?.questionType !== 1 && !this.demographic.selected_opt) return true;
        if (this.isNotValidDate) return true;
        return false;
    }
}