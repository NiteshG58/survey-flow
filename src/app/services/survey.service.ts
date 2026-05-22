import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError, timer, firstValueFrom } from 'rxjs';
import { catchError, map, switchMap, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { SURVEY_CONFIG } from '../config/survey.config';
import { SurveyQuestion, SurveyTransaction, LocalStorageAnswer } from '../models/survey.types';

@Injectable({
    providedIn: 'root'
})
export class SurveyService {
    private apiUrl = environment.apiUrl;
    private baseUrl = environment.baseUrl;

    constructor(private http: HttpClient) { }

    // API Methods
    getBypassdata(): Observable<any> {
        return this.http.get(`${this.apiUrl}/getBypass/`);
    }

    getTargettingQuestions(condition: any, limit: number, sort: any): Observable<any> {
        const data = { condition, sort, limit };
        return this.http.post(`${this.apiUrl}/getQuestions/`, data);
    }

    preSurveyTerminationInQA(body: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/preSurveyTerminationInQA/`, body);
    }

    updateGrpTargetStats(body: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/updateGrpTargetStats/`, body);
    }

    getSupplierUrl(queryStrings: string): Observable<any> {
        return this.http.get(`${this.baseUrl}/getSurveyLiveUrl/?${queryStrings}`);
    }

    getSupplierTestUrl(queryStrings: string): Observable<any> {
        return this.http.get(`${this.baseUrl}/getSurveyTestUrl/?${queryStrings}`);
    }

    getDecryptedSurvNum(survNum: string): Observable<any> {
        return this.http.get(`${this.apiUrl}/get_decrypted_suvrnum/${survNum}`);
    }

    getDecryptedUID(uid: string): Observable<any> {
        return this.http.get(`${this.apiUrl}/get_decrypted_uid/${uid}`);
    }

    getSurveyTrgtQuestions(grpId: number): Observable<any> {
        return this.http.get(`${this.apiUrl}/getSurveyTrgtQuestions/${grpId}`);
    }

    getTargetStats(grpId: number): Observable<any> {
        return this.http.get(`${this.apiUrl}/getTargetStats/${grpId}`);
    }

    getSurveyDetails(surId: number, supplierId?: string): Observable<any> {
        let url = `${this.apiUrl}/getSurveyDetails/${surId}`;
        if (supplierId) {
            url += `?supplier_id=${supplierId}`;
        }
        return this.http.get(url);
    }

    getTransaction(trId: string): Observable<any> {
        return this.http.get(`${this.apiUrl}/getTransaction/${trId}`);
    }

    syncProfilingQusWithPanel(body: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/syncProfilingQusWithPanel/`, body);
    }

    getDySur(body: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/getDySur/`, body);
    }

    getPSFusionSur(body: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/getPSFusionSur/`, body);
    }

    getZipMasterData(data: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/getZipMasterData`, data);
    }

    // Research Defender Integration (Optimized with RxJS)
    async researchDfdFunction(token: string, grp_id: number, supId: string, surData: any, pid: string): Promise<any> {
        if (!SURVEY_CONFIG.resrchDefender.enabled) {
            return Promise.resolve("Research Defender is disabled in config");
        }
        if (surData.resrchDfdActCheck === 1 && surData.resrchDfdChk === 1) {
            return Promise.reject("Error: Missing required parameters in researchDfdFunction");
        }

        if (surData.resrchDfdChk === 1 && surData.resrchDfdActCheck === 1) {
            return this.researchDefenderActivityApi(token, grp_id, supId).then(activityResult => {
                return this.researchDefenderGetTokenApi(pid).then(tokenResult => {
                    return firstValueFrom(this.saveResrchDfenderResp(tokenResult, true, false, activityResult, true, false, token, grp_id, supId, surData, pid));
                });
            }).catch(async error => {
                if (error.isActivityApiError) {
                    const activityError = error;
                    try {
                        const tokenResult = await this.researchDefenderGetTokenApi(pid);
                        return firstValueFrom(this.saveResrchDfenderResp(tokenResult, true, false, activityError, false, activityError.isRDActvtyTimeout, token, grp_id, supId, surData, pid));
                    } catch (tokenError: any) {
                        return firstValueFrom(this.saveResrchDfenderResp(tokenError, false, tokenError.isRDGetTimeout, activityError, false, activityError.isRDActvtyTimeout, token, grp_id, supId, surData, pid));
                    }
                } else {
                    const tokenError = error;
                    return firstValueFrom(this.saveResrchDfenderResp(tokenError, false, tokenError.isRDGetTimeout, null, true, false, token, grp_id, supId, surData, pid));
                }
            });
        } else if (surData.resrchDfdChk === 1) {
            return this.researchDefenderGetTokenApi(pid).then(tokenData => {
                return firstValueFrom(this.saveResrchDfenderResp(tokenData, true, false, "Activity Api Not Enabled For this Survey", true, false, token, grp_id, supId, surData, pid));
            }).catch(error => {
                const tokenError = error || { status: "unknown", message: "Error in rdToken" };
                return firstValueFrom(this.saveResrchDfenderResp(tokenError, false, error.isRDGetTimeout, "Activity Api Not Enabled", true, false, token, grp_id, supId, surData, pid));
            });
        }
        return Promise.resolve("Research Defender is not enabled");
    }

    researchDefenderActivityApi(token: string, grpId: number, supId: string): Promise<any> {
        const config = SURVEY_CONFIG.resrchDefender;
        const rdActivityUrl = `${config.activityURL}?range=${config.activity_range}&survey_number=${grpId}&session_id=${token}&supplier_id=${supId}`;

        return firstValueFrom(
            this.http.get(rdActivityUrl, { headers: config.headers }).pipe(
                timeout(config.activityTimeout),
                catchError(err => {
                    const isTimeout = err.name === 'TimeoutError';
                    return throwError(() => ({
                        error: err,
                        status: isTimeout ? "timeout" : "error",
                        isRDActvtyTimeout: isTimeout,
                        isActivityApiError: true,
                        message: isTimeout ? "Activity Timeout" : "Activity Error",
                    }));
                })
            )
        );
    }

    researchDefenderGetTokenApi(pid: string): Promise<any> {
        const config = SURVEY_CONFIG.resrchDefender;
        const rdGetTokenUrl = `${config.getTokenAPI}${config.publishable_key}?tokens=1&rt_sr_pd=${pid}`;

        return firstValueFrom(
            this.http.get(rdGetTokenUrl, { withCredentials: true }).pipe(
                timeout(config.getTokenTimeout),
                catchError(err => {
                    const isTimeout = err.name === 'TimeoutError';
                    return throwError(() => ({
                        error: err,
                        status: isTimeout ? "timeout" : "error",
                        isRDGetTimeout: isTimeout,
                        message: isTimeout ? "Token Timeout" : "Token Error",
                    }));
                })
            )
        );
    }

    saveResrchDfenderResp(rdResp: any, isSuccess: boolean, isRDGetTimeout: boolean, actvtResp: any, isActvtSuccess: boolean, isRDActvtyTimeout: boolean, token: string, grp_id: number, supId: string, surData: any, pid: string): Observable<any> {
        let bodyObj: any = {
            token: token,
            isRDActvtyTimeout,
            isRDGetTokenTimeout: isRDGetTimeout,
            surveyId: grp_id,
            supCode: supId,
            PID: pid || '',
            surData: surData
        };
        bodyObj[isSuccess ? 'getTokenAPIData' : 'rdGetTokenError'] = rdResp;
        bodyObj[isActvtSuccess ? 'actvtyAPIData' : 'rdActvtyError'] = actvtResp;

        const data = { encodedData: this.encryptDataBase64(JSON.stringify(bodyObj)) };
        return this.http.post(`${this.apiUrl}/saveResrchDfenderResp/`, data);
    }

    verisoulFunction(token: string, grp_id: number, supId: string, surData: any): Promise<any> {
        return new Promise((resolve, reject) => {
            (window as any).Verisoul.session().then((res: any) => {
                if (res && res.session_id) {
                    const payload = {
                        session_id: res.session_id,
                        surid: grp_id,
                        transid: token,
                        supid: supId,
                        surData: surData || null
                    };
                    firstValueFrom(this.http.post(`${this.apiUrl}/verisoul/authenticate`, payload))
                        .then((response: any) => {
                            console.log('Verisoul BE Response:', response);
                            if (response && response.redirect) {
                                window.location.href = response.url;
                            } else {
                                resolve(response);
                            }
                        })
                        .catch((err: any) => {
                            console.error('Verisoul BE Error:', err);
                            reject(err);
                        });
                } else {
                    reject('Verisoul session returned no session_id');
                }
            }).catch((err: any) => {
                console.error('Verisoul: Session capture failed.', err);
                reject(err);
            });
        });
    }

    // Local Storage
    saveChoicesTemporarily(tempAnswer: any, keyForSaving: string, question_key: string): void {
        let userSavedAnswers: any[] = JSON.parse(localStorage.getItem('localStorageSavedAnswers') || '[]');
        let foundKey = false;

        userSavedAnswers.forEach((data: any, key: number) => {
            if (data[keyForSaving] !== undefined) {
                foundKey = true;
                let savedData = data[keyForSaving];
                let index = savedData.findIndex((s: any) => s[question_key] !== undefined);
                if (index > -1) savedData[index][question_key] = tempAnswer;
                else savedData.push({ [question_key]: tempAnswer });
                userSavedAnswers[key][keyForSaving] = savedData;
            }
        });

        if (!foundKey) userSavedAnswers.push({ [keyForSaving]: [{ [question_key]: tempAnswer }] });
        localStorage.setItem('localStorageSavedAnswers', JSON.stringify(userSavedAnswers));
    }

    getSavedAnswers(keyForSaving: string): any {
        const saved = JSON.parse(localStorage.getItem('localStorageSavedAnswers') || '[]');
        let result: any = {};
        saved.forEach((data: any) => {
            if (data[keyForSaving]) {
                data[keyForSaving].forEach((ans: any) => Object.assign(result, ans));
            }
        });
        return result;
    }

    deleteKeyLocalStorageSavedAnswers(keyForSaving: string): void {
        const saved = JSON.parse(localStorage.getItem('localStorageSavedAnswers') || '[]');
        const filtered = saved.map((data: any) => {
            if (data[keyForSaving]) delete data[keyForSaving];
            return data;
        }).filter((data: any) => Object.keys(data).length > 0);
        localStorage.setItem('localStorageSavedAnswers', JSON.stringify(filtered));
    }

    // Redirect with Auth Context
    redirectToSupplierURL(queryStrings: string, router: any, context: any): Observable<any> {
        return this.getSupplierUrl(queryStrings).pipe(
            switchMap(data => {
                const needsTermination = (data.apiStatus === "quota_closed" || data.apiStatus === "toluna_err" || data.apiStatus === "RD_response_empty");
                if (needsTermination) {
                    const body = {
                        S: data.apiStatus === "RD_response_empty" ? 8 : (data.apiStatus === "quota_closed" ? 7 : 5),
                        token: context.token,
                        reason: data.msg,
                        jobId: context.jb_id,
                        supCode: context.supCode,
                        surId: context.grp_id,
                        PID: context.PID,
                        isFraud: 0
                    };
                    return this.preSurveyTerminationInQA(body).pipe(
                        map(res => {
                            router.navigate(['screenersurvey', 'closed'], { queryParams: { message: '5' } });
                            if (res?.url) setTimeout(() => window.location.href = res.url, 2000);
                            return res;
                        })
                    );
                } else {
                    if (data.supplierUrl) window.location.href = data.supplierUrl;
                    return of(data);
                }
            }),
            catchError(err => {
                router.navigate(['screenersurvey', 'closed'], { queryParams: { message: '1' } });
                return throwError(() => err);
            })
        );
    }

    saveTrueSampleResponse(body: any): Observable<any> {
        const data = { encodedData: this.encryptDataBase64(JSON.stringify(body)) };
        return this.http.post(`${this.apiUrl}/saveTrueSampleResponse/`, data);
    }

    updateAllTargetData(body: any): Observable<any> {
        return this.http.post(`${this.apiUrl}/updateAllTargetData/`, body);
    }

    replaceAgeGender(queryStrings: string, keyForSaving: string): string {
        const saved = this.getSavedAnswers(keyForSaving);
        let updated = queryStrings;

        // Match legacy logic: check for AGE/GENDER in query string and replace if present
        ['AGE', 'GENDER'].forEach(key => {
            const ans = saved[key]?.answer;
            if (ans && updated.toLowerCase().includes(key.toLowerCase() + 'val')) {
                const regex = new RegExp(key + 'val', 'gi');
                updated = updated.replace(regex, ans);
            }
        });
        return updated;
    }

    // Crypto Helpers
    encryptDataBase64(data: string): string {
        return btoa(encodeURIComponent(data));
    }

    decodeBase64(base64: string): string {
        if (!base64 || typeof base64 !== 'string') return '';
        try {
           // return decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
           return atob(base64);
        } catch (e) {
            console.error('Decoding error:', e);
            return '';
        }
    }

    serialize(obj: any): string {
        return Object.keys(obj).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(obj[k])}`).join('&');
    }

    // Logic Helpers
    intersection_destructive(a: any[], b: any[]): any[] {
        let result: any[] = [];
        let copyA = [...a].sort((x, y) => x - y);
        let copyB = [...b].sort((x, y) => x - y);
        while (copyA.length > 0 && copyB.length > 0) {
            if (copyA[0] < copyB[0]) copyA.shift();
            else if (copyA[0] > copyB[0]) copyB.shift();
            else { result.push(copyA.shift()); copyB.shift(); }
        }
        return result;
    }

    anyMatchInOptions(answer: any[], optionIds: string[]): boolean {
        return answer.some(ans => optionIds.includes(ans.toString()));
    }

    checkTermination(qId: any, qType: any, trgQuestions: any[], answer: any, countryCode: string): boolean {
        const q = trgQuestions.find(it => it.q_id?.toString() === qId.toString());
        if (!q) return false;

        const options = q.opts || [];
        const optIds = options.map((o: any) => o.opt_id?.toString());
        const qKey = q.q_key;

        switch (Number(qType)) {
            case 3: // NUMERIC
                if (qKey === 'AGE') {
                    const age = parseInt(answer);
                    return !options.some((o: any) => age >= parseInt(o.startAge) && age <= parseInt(o.endAge));
                }
                if (qKey === 'ZIPCODES') return !options.some((o: any) => o.opt_txt.toString() === answer.toString());
                break;
            case 0: // SINGLE
                if (!optIds.includes(answer.toString())) return true;
                if (q.termOpts?.some((t: any) => t.opt_id.toString() === answer.toString())) return true;
                break;
            case 1: // MULTI
                const ansArr = Array.isArray(answer) ? answer : [answer];
                if (!this.anyMatchInOptions(ansArr, optIds)) return true;
                if (ansArr.length > (q.termsCount || 999)) return true;
                if (q.termOpts?.some((t: any) => ansArr.includes(t.opt_id.toString()))) return true;
                break;
        }
        return false;
    }

    getNextState(questions: any[], currentStateKey: string): string {
        const html2txt = (msg: string) => msg.toLowerCase().replace(/#/g, 'hash').replace(/-/g, 'dash').replace(/&/g, 'and');
        const idx = questions.findIndex(q => html2txt(q.questionKey) === html2txt(currentStateKey));
        return (idx > -1 && questions[idx + 1]) ? html2txt(questions[idx + 1].questionKey) : 'final';
    }
}
