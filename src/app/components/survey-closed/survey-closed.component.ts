import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { SURVEY_CONFIG } from '../../config/survey.config';

@Component({
  selector: 'app-survey-closed',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container mt-5 text-center">
      <div class="card shadow-sm p-5 border-0 rounded-4">
        <div class="card-body">
          <h1 class="display-5 fw-bold mb-4 text-primary">{{ heading }}</h1>
          <p class="lead text-muted">{{ message }}</p>
          <div *ngIf="showSupport" class="mt-4 pt-4 border-top">
            <p class="small text-secondary">If you believe this is an error, please contact our support team.</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .container { max-width: 800px; }
    h1 { font-family: 'Outfit', sans-serif; }
    p { font-family: 'Inter', sans-serif; }
  `]
})
export class SurveyClosedComponent implements OnInit {
  heading: string = 'Survey Unavailable';
  message: string = 'Sorry, this survey is currently not available.';
  showSupport: boolean = false;

  constructor(private route: ActivatedRoute) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const msgId = params['message'] || '0';
      const cfg = (SURVEY_CONFIG.surveyClosedMessages as any)[msgId] || SURVEY_CONFIG.surveyClosedMessages[0];

      this.heading = cfg.h1;
      this.message = cfg.h4;

      // msg 1: Disqualified, msg 5: OverQuota
      if (msgId === '1' || msgId === '5') {
        this.showSupport = false;
      } else {
        this.showSupport = true;
      }
    });
  }
}
