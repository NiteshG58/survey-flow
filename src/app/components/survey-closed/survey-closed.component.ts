import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SURVEY_CONFIG } from '../../config/survey.config';

@Component({
  selector: 'app-survey-closed',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container mt-5 text-center" [dir]="rtlLangCheck ? 'rtl' : 'ltr'" [class.rtl-mode]="rtlLangCheck">
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
    .rtl-mode { text-align: right; }
  `]
})
export class SurveyClosedComponent implements OnInit {
  heading: string = 'Survey Unavailable';
  message: string = 'Sorry, this survey is currently not available.';
  showSupport: boolean = false;
  rtlLangCheck: boolean = false;
  lang: string = 'english';

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) { }

  private checkRtlText(text: string): boolean {
    const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF\uFB1D-\uFB4F]/;
    return rtlRegex.test(text);
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const msgId = params['message'] || '0';
      
      const queryLang = params['Lang'] || params['lang'] || 'english';
      this.lang = queryLang.toLowerCase();

      // Check by language name first
      const rtlLangs = ['arabic', 'urdu', 'hebrew', 'persian', 'farsi', 'yiddish', 'syriac', 'pashto', 'sindhi'];
      this.rtlLangCheck = rtlLangs.includes(this.lang);

      // Fallback default config
      const cfg = (SURVEY_CONFIG.surveyClosedMessages as any)[msgId] || SURVEY_CONFIG.surveyClosedMessages[0];
      this.heading = cfg.h1;
      this.message = cfg.h4;

      // msg 1: Disqualified, msg 5: OverQuota
      if (msgId === '1' || msgId === '5') {
        this.showSupport = false;
      } else {
        this.showSupport = true;
      }

      // Fetch multilingual translation JSON
      this.http.get(`/multiLingual/${this.lang}.json`).subscribe({
        next: (json: any) => {
          if (msgId === '1' || msgId === '5') {
            this.heading = json['srvyClose.hdng1'] || this.heading;
            this.message = json['srvyClose.hdng2'] || json[`srvyClose.msg${msgId}`] || this.message;
          } else {
            this.heading = json['srvyClose.hdng0'] || this.heading;
            this.message = json[`srvyClose.msg${msgId}`] || this.message;
          }

          // Scan translated labels for RTL characters
          if (this.checkRtlText(this.heading) || this.checkRtlText(this.message)) {
            this.rtlLangCheck = true;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn(`[SurveyClosed] Could not load translation file for language: ${this.lang}`, err);
          if (this.checkRtlText(this.heading) || this.checkRtlText(this.message)) {
            this.rtlLangCheck = true;
          }
          this.cdr.markForCheck();
        }
      });
    });
  }
}

