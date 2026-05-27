import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
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

  ngOnInit(): void {
    // Guard: if someone lands here directly with no pending redirect data, bounce to closed.
    const pending = this.surveyService.pendingFinalRedirect;
    if (!pending) {
      console.warn('[SurveyFinal] No pending redirect data found – redirecting to closed.');
      this.router.navigate(['screenersurvey', 'closed'], { 
        queryParams: { ...this.route.snapshot.queryParams, message: '1' } 
      });
      return;
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
