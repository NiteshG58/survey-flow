import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, Params } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription, Observable, firstValueFrom } from 'rxjs';
import { SurveyService } from '../../services/survey.service';
import { SurveyQuestion, QuestionType } from '../../models/survey.types';
import { SURVEY_CONFIG } from '../../config/survey.config';
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

    private routeSub?: Subscription;
    private querySub?: Subscription;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private surveyService: SurveyService,
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
            this.rtlLangCheck = this.language === 'arabic';
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
            const detailsData = await firstValueFrom(this.surveyService.getSurveyDetails(this.grpId, this.supId));
            this.surData = JSON.parse(this.surveyService.decodeBase64(detailsData.surveyDetail));
            this.countryCode = this.surData.cntCode || 'US';

            // 3. Security: Research Defender
            if (!isTest && this.surData.resrchDfdChk === 1) {
                await this.surveyService.researchDfdFunction(this.token, this.grpId, this.supId, this.surData, this.PID);
            }

            // Verisoul
            if (!isTest && this.surData.verisoulCheck === 1 && (SURVEY_CONFIG as any).verisoul?.enabled) {
                const runVerisoulFlow = async () => {
                    try {
                        await this.surveyService.verisoulFunction(this.token, this.grpId, this.supId, this.surData);
                    } catch (error) {
                        console.error('Error in Verisoul function:', error);
                        this.router.navigate(['access-denied']);
                        throw error;
                    }
                };

                const v = (SURVEY_CONFIG as any).verisoul;
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

            // 4. Screener Bypass
            if (this.surData.screenerBypass) {
                const bypass = await firstValueFrom(this.surveyService.getBypassdata());
                if (!bypass.bypass) {
                    this.finalRedirect(this.surveyService.serialize(params));
                    return;
                }
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
            const rawQuestions = await firstValueFrom(this.surveyService.getTargettingQuestions({ id: qIds, language: this.language }, 100, { seq: 1 }));
            this.questions = JSON.parse(this.surveyService.decodeBase64(rawQuestions.question));
            
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

            console.log('Parsed questions array:', this.questions);

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

        if (this.currentQuestion.questionKey === 'BIRTH_DATE' || this.currentQuestion.id === SURVEY_CONFIG.dobQuesId) {
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
            console.log('Finding next question - Saved:', saved);

            const unanswered = this.questions.find(q => {
                const key = (q as any).QuestionKey || q.questionKey;
                const isAnswered = !!saved[key];
                const isExists = this.existIds.includes(q.id.toString());
                return !isAnswered && !isExists;
            });

            if (unanswered) {
                const nextKey = (unanswered as any).QuestionKey || unanswered.questionKey;
                console.log('Navigating to next unanswered question:', nextKey);
                this.router.navigate(['screenersurvey', this.html2txt(nextKey)], { queryParamsHandling: 'preserve' });
                this.resetForm();
            } else {
                console.log('No more unanswered questions. Calling nextFinal()...');
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
        console.log('Final check - Saved Answers:', saved);
        console.log('Final check - questions to verify:', this.questions);
        console.log('Final check - existIds:', this.existIds);

        // **URL Manipulation Check** (PSQT)
        const allAnswered = this.questions.every(q => {
            const key = (q as any).QuestionKey || q.questionKey;
            const isAnswered = !!saved[key];
            const isExists = this.existIds.includes(q.id.toString());
            if (!isAnswered && !isExists) {
                console.warn(`URL Manipulation: Question "${key}" (ID: ${q.id}) not answered and not in existIds`);
            }
            return isAnswered || isExists;
        });

        if (!allAnswered && !this.surData.screenerBypass) {
            console.error('URL Manipulation Check Failed! Terminating...');
            const body = { S: 8, token: this.token, reason: "URL Manipulation", jobId: this.surData.prj_id, supCode: this.supId, surId: this.grpId, PID: this.PID, isFraud: 0 };
            this.surveyService.preSurveyTerminationInQA(body).subscribe(d => {
                if (d?.url) window.location.href = d.url;
                else this.closeSurvey('1');
            });
            return;
        }
        console.log('URL Manipulation Check Passed. Proceeding to supplier redirect...');

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
                this.handleRedirectionFlow(queryStrings);
            });
        } else {
            // Special Case: Inbox Supplier (Device ID)
            if (this.supId === SURVEY_CONFIG.inboxSupId) {
                this.surveyService.getTransaction(this.token).subscribe(trans => {
                    const jobTrans = JSON.parse(this.surveyService.decodeBase64(trans.jobTrans));
                    const rvid = jobTrans.RIDResp?.RVid;
                    if (rvid) {
                        const panelistUserObj = { PID: this.PID, supCode: this.supId, grp_id: this.grpId, tr_id: this.token, deviceId: rvid };
                        this.surveyService.updateAllTargetData(panelistUserObj).subscribe(() => this.handleRedirectionFlow(queryStrings));
                    } else {
                        this.handleRedirectionFlow(queryStrings);
                    }
                });
            } else {
                this.handleRedirectionFlow(queryStrings);
            }
        }
    }

    private handleRedirectionFlow(queryStrings: string): void {
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

        if (this.surData.cid === SURVEY_CONFIG.dynataCustId) {
            this.surveyService.getDySur(encoded).subscribe(d => d.redirect ? (window.location.href = d.url) : this.sendRecaptcha(queryStrings));
        } else if (this.surData.cid === SURVEY_CONFIG.psCustId) {
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
        const cfg = SURVEY_CONFIG.dynataMinAge.find(it => it.cntCode === this.countryCode) || { minAge: 18 };
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
            (window as any).gtag('config', SURVEY_CONFIG.GA_TRACKING_ID, { 'page_path': this.router.url });
        }
    }

    private closeSurvey(msgId: string): void {
        this.router.navigate(['screenersurvey', 'closed'], { queryParams: { message: msgId } });
    }
}
