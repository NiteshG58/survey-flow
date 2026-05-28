import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SURVEY_CONFIG } from '../../config/survey.config';

@Component({
  selector: 'app-survey-closed',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './survey-closed.component.html',
  styleUrls: ['./survey-closed.component.css']
})
export class SurveyClosedComponent implements OnInit {
  heading: string = 'Survey Unavailable';
  message: string = 'Sorry, this survey is currently not available.';
  subHeading: string = '';
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
      this.subHeading = '';

      // msg 1: Disqualified, msg 5: OverQuota
      if (msgId === '1' || msgId === '5') {
        this.showSupport = false;
        this.subHeading = 'Unfortunately, you do not qualify for this survey.';
        if (msgId === '5') {
          this.subHeading = 'The quota for this survey has been filled.';
        }
      } else {
        this.showSupport = true;
        this.subHeading = 'Please try again later or contact support.';
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
          if (this.checkRtlText(this.heading) || this.checkRtlText(this.message) || this.checkRtlText(this.subHeading)) {
            this.rtlLangCheck = true;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.warn(`[SurveyClosed] Could not load translation file for language: ${this.lang}`, err);
          if (this.checkRtlText(this.heading) || this.checkRtlText(this.message) || this.checkRtlText(this.subHeading)) {
            this.rtlLangCheck = true;
          }
          this.cdr.markForCheck();
        }
      });
    });
  }
}