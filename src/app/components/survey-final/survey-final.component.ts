import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SurveyService } from '../../services/survey.service';

@Component({
  selector: 'app-survey-final',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './survey-final.component.html',
  styles: []
})
export class SurveyFinalComponent implements OnInit {

  isLoading = false;
  lang = 'english';
  rtlLangCheck = false;

  checkRtlText(text: string): boolean {
    const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF\uFB1D-\uFB4F]/;
    return rtlRegex.test(text);
  }

  // Custom message override fields from backend
  srvyMsgPara = '';
  preSurvMsg = '';

  // Translation defaults
  instructionLabel = 'Instruction';
  msgPara = '';
  prdctOpinionMsg = '';
  rsnpAns = '';
  btnLtsDo = "Let's Do It";
  grpMsgLabel = 'Important Message';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private surveyService: SurveyService,
    private cdr: ChangeDetectorRef
  ) { }

  async ngOnInit(): Promise<void> {
    // Guard: if someone lands here directly with no pending redirect data, attempt to reconstruct it from query parameters.
    let pending = this.surveyService.pendingFinalRedirect;
    if (!pending) {
      console.warn('[SurveyFinal] No pending redirect data found – attempting to initialize dynamically from query parameters.');
      try {
        const params = this.route.snapshot.queryParams;
        const encryptedSurvey = params['survey'];
        const supId = params['supId'] || params['supplierId'] || '';
        const PID = params['pid'] || 'Test';

        if (!encryptedSurvey) {
          throw new Error('Missing survey query parameter');
        }

        // 1. Decrypt Data
        console.log('[SurveyFinal] Decrypting survey number...');
        const grpData = await firstValueFrom(this.surveyService.getDecryptedSurvNum(encryptedSurvey));
        const grpId = parseInt(grpData.decText[0]);

        let token = '';
        if (params['uid']) {
          console.log('[SurveyFinal] Decrypting token UID...');
          const uidData = await firstValueFrom(this.surveyService.getDecryptedUID(params['uid']));
          token = uidData.decText;
        }

        // 2. Fetch Details
        console.log('[SurveyFinal] Fetching survey details for grpId:', grpId, 'supId:', supId);
        const detailsData = await firstValueFrom(this.surveyService.getSurveyDetails(grpId, supId));
        const surData = JSON.parse(this.surveyService.decodeBase64(detailsData.surveyDetail));
        const countryCode = surData.cntCode || 'US';
        const isRecaptcha = surData.recaptchaCheck === 1;

        // 3. Check Global Bypass Data
        console.log('[SurveyFinal] Fetching global bypass settings...');
        const bypassData = await firstValueFrom(this.surveyService.getBypassdata());
        const isGlobalBypass = bypassData.bypass; // True means show instructions page, False means redirect immediately

        let queryStrings = this.surveyService.serialize(params);
        queryStrings = this.surveyService.replaceAgeGender(queryStrings, `${grpId}_${PID}`);

        // Reconstruct the pending context
        pending = {
          queryStrings,
          surData,
          cid: surData.cid,
          token,
          supId,
          grpId,
          PID,
          countryCode,
          isRecaptcha
        };
        this.surveyService.pendingFinalRedirect = pending;
        console.log('[SurveyFinal] Dynamic context reconstructed:', pending);

        // If global bypass is false (meaning immediate redirect):
        if (!isGlobalBypass) {
          console.log('[SurveyFinal] Global bypass is false – redirecting immediately to supplier URL.');
          this.startSurvey();
          return;
        }

      } catch (error) {
        console.error('[SurveyFinal] Failed to initialize redirect data:', error);
        this.router.navigate(['screenersurvey', 'closed'], { 
          queryParams: { ...this.route.snapshot.queryParams, message: '1' } 
        });
        return;
      }
    }

    // Set custom messages from surData if present (robust handling of empty/whitespace/null/undefined settings)
    if (pending.surData) {
      const rawMsg = pending.surData.srvy_msg_para;
      if (rawMsg !== null && rawMsg !== undefined) {
        const strMsg = String(rawMsg).trim();
        this.srvyMsgPara = (strMsg !== '' && strMsg !== 'null' && strMsg !== 'undefined') ? strMsg : '';
      } else {
        this.srvyMsgPara = '';
      }

      const rawPreMsg = pending.surData.pre_surv_msg;
      if (rawPreMsg !== null && rawPreMsg !== undefined) {
        const strPreMsg = String(rawPreMsg).trim();
        this.preSurvMsg = (strPreMsg !== '' && strPreMsg !== 'null' && strPreMsg !== 'undefined') ? strPreMsg : '';
      } else {
        this.preSurvMsg = '';
      }
    }

    // Determine language and RTL status
    const queryLang = this.route.snapshot.queryParams['Lang'] || this.route.snapshot.queryParams['lang'] || 'english';
    this.lang = queryLang.toLowerCase();

    // Check by language name first
    const rtlLangs = ['arabic', 'urdu', 'hebrew', 'persian', 'farsi', 'yiddish', 'syriac', 'pashto', 'sindhi'];
    this.rtlLangCheck = rtlLangs.includes(this.lang);

    // Additionally scan custom messages for RTL characters
    if (this.checkRtlText(this.srvyMsgPara) || this.checkRtlText(this.preSurvMsg)) {
      this.rtlLangCheck = true;
    }

    // Load multilingual translation JSON using absolute path to avoid 404 under nested router views
    this.http.get(`/multiLingual/${this.lang}.json`).subscribe({
      next: (json: any) => {
        this.instructionLabel = json['srvyPrcs.Instruction'] || 'Instruction';
        this.msgPara = json['srvyFinal.msgPara'] || '';
        this.prdctOpinionMsg = json['srvyFinal.prdctOpinionMsg'] || '';
        this.rsnpAns = json['srvyFinal.rsnpAns'] || '';
        this.btnLtsDo = json['srvyFinal.btnLtsDo'] || "Let's Do It";
        this.grpMsgLabel = json['srvyFinal.grpMsg'] || 'Important Message';

        // Scan translated labels for RTL characters
        if (this.checkRtlText(this.instructionLabel) || this.checkRtlText(this.msgPara)) {
          this.rtlLangCheck = true;
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.warn(`[SurveyFinal] Could not load translation file for language: ${this.lang}`, err);
        // Fallback defaults (English)
        this.instructionLabel = 'Instruction';
        this.msgPara = 'You have qualified for the survey. We are now redirecting you to the survey page. Please note, some of the qualification questions might be asked again.';
        this.prdctOpinionMsg = 'Please read the questions carefully and be honest when offering your answers and your responses are anonymous and will not be identified with you in any way.';
        this.rsnpAns = 'Thank you for your time and feedback!';
        this.btnLtsDo = "Go to Survey";
        this.grpMsgLabel = 'Important Message';

        if (this.checkRtlText(this.instructionLabel) || this.checkRtlText(this.msgPara)) {
          this.rtlLangCheck = true;
        }
        this.cdr.markForCheck();
      }
    });
  }

  startSurvey(): void {
    const pending = this.surveyService.pendingFinalRedirect;

    if (!pending) {
      this.router.navigate(['screenersurvey', 'closed'], { 
        queryParams: { ...this.route.snapshot.queryParams, message: '1' } 
      });
      return;
    }

    this.isLoading = true;

    const { queryStrings, token, supId, grpId, PID, countryCode, isRecaptcha } = pending;

    // Replicate sendRecaptcha → finalRedirect → redirectToSupplierURL chain from QuestionnaireComponent.
    const skipRecaptcha = countryCode === 'CN' || !isRecaptcha;

    if (skipRecaptcha) {
      // finalRedirect
      const ctx = { token, jb_id: pending.surData?.prj_id, supCode: supId, grp_id: grpId, PID };
      this.surveyService.redirectToSupplierURL(queryStrings, this.router, ctx).subscribe({
        error: () => { 
          this.isLoading = false; 
          this.cdr.markForCheck();
        }
      });
    } else {
      // Recaptcha needed – for now fall through to supplier URL (extend here if recaptcha UI is needed)
      console.log('[SurveyFinal] Recaptcha required but not yet implemented in final page – proceeding directly.');
      const ctx = { token, jb_id: pending.surData?.prj_id, supCode: supId, grp_id: grpId, PID };
      this.surveyService.redirectToSupplierURL(queryStrings, this.router, ctx).subscribe({
        error: () => { 
          this.isLoading = false; 
          this.cdr.markForCheck();
        }
      });
    }

    // Clear the stored data after use.
    this.surveyService.pendingFinalRedirect = null;
  }
}
