import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
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

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private surveyService: SurveyService
  ) { }

  ngOnInit(): void {
    // Guard: if someone lands here directly with no pending redirect data, bounce to closed.
    if (!this.surveyService.pendingFinalRedirect) {
      console.warn('[SurveyFinal] No pending redirect data found – redirecting to closed.');
      this.router.navigate(['screenersurvey', 'closed'], { queryParams: { message: '1' } });
    }
  }

  startSurvey(): void {
    const pending = this.surveyService.pendingFinalRedirect;

    if (!pending) {
      this.router.navigate(['screenersurvey', 'closed'], { queryParams: { message: '1' } });
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
        error: () => { this.isLoading = false; }
      });
    } else {
      // Recaptcha needed – for now fall through to supplier URL (extend here if recaptcha UI is needed)
      console.log('[SurveyFinal] Recaptcha required but not yet implemented in final page – proceeding directly.');
      const ctx = { token, jb_id: pending.surData?.prj_id, supCode: supId, grp_id: grpId, PID };
      this.surveyService.redirectToSupplierURL(queryStrings, this.router, ctx).subscribe({
        error: () => { this.isLoading = false; }
      });
    }

    // Clear the stored data after use.
    this.surveyService.pendingFinalRedirect = null;
  }
}
