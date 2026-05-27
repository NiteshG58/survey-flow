import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, Params } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SurveyService } from '../../services/survey.service';
import { SURVEY_CONFIG } from '../../config/survey.config';

declare var DeviceIQ: any;

@Component({
    selector: 'app-survey-redirect',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="redirect-body" [class.rtl-mode]="rtlLangCheck">
      <div class="row justify-content-center pt-5 mt-5">
        <div class="col-md-8 text-center">
          <h1>{{ heading }}</h1>
          <h4 [dir]="rtlLangCheck ? 'rtl' : 'ltr'">{{ subHeading }}</h4>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .redirect-body {
      min-height: 100vh;
      background: #f8f9fa;
      padding-top: 15%;
    }
    .rtl-mode { text-align: right; }
  `]
})
export class SurveyRedirectComponent implements OnInit, OnDestroy {
    heading: string = '';
    subHeading: string = 'Redirecting...';
    rtlLangCheck: boolean = false;

    private params: any;

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private surveyService: SurveyService,
        private http: HttpClient,
        private cdr: ChangeDetectorRef
    ) { }

    private checkRtlText(text: string): boolean {
        const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF\uFB1D-\uFB4F]/;
        return rtlRegex.test(text);
    }

    ngOnInit(): void {
        this.route.queryParams.subscribe((params: Params) => {
            this.params = params;
            const langParam = (params['Lang'] || params['lang'] || 'english').toLowerCase();
            const rtlLangs = ['arabic', 'urdu', 'hebrew', 'persian', 'farsi', 'yiddish', 'syriac', 'pashto', 'sindhi'];
            this.rtlLangCheck = rtlLangs.includes(langParam);
            this.initializeRedirect();
        });
    }

    ngOnDestroy(): void {
    }

    private initializeRedirect(): void {
        const lang = (this.params['lang'] || 'english').toLowerCase();

        // Load multilingual labels using absolute path to avoid 404 under nested paths
        this.http.get(`/multiLingual/${lang}.json`).subscribe({
            next: (json: any) => {
                this.subHeading = json['redirect.title'] || 'Redirecting...';
                if (this.checkRtlText(this.subHeading)) {
                    this.rtlLangCheck = true;
                }
                this.cdr.markForCheck();
                this.startFlow();
            },
            error: () => {
                this.subHeading = 'Redirecting...';
                this.cdr.markForCheck();
                this.startFlow();
            }
        });
    }

    private startFlow(): void {
        const isFingerprint = !!this.params['tsFingerPrintType'];
        if (isFingerprint) {
            this.loadDeviceIQScript();
        } else {
            // Standard delay redirect (mirroring pp-redirect.html)
            setTimeout(() => {
                const actualUrl = this.params['au'];
                if (actualUrl) window.location.href = actualUrl;
            }, 3000);
        }
    }

    private loadDeviceIQScript(): void {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.id = 'ts_device_script_id';
        script.src = 'https://api-cdn.truesample.com/Scripts/Device/deviceapi-v4.0.2.min.js';
        script.setAttribute('data-key', SURVEY_CONFIG.deviceIQKey);

        script.onload = () => {
            this.runDeviceIQ();
        };

        script.onerror = () => {
            this.heading = 'Error';
            this.subHeading = 'Failed to load redirection security script.';
            this.cdr.markForCheck();
        };

        document.head.appendChild(script);
    }

    private runDeviceIQ(): void {
        const requestId = this.params['token'];
        const eventId = this.params['jb_id'];
        const subEventId = this.params['grp_id'];
        const ISOCode = this.params['ISOCode'];
        const postalCode = this.params['postalCode'] || null;

        if (typeof DeviceIQ !== 'undefined') {
            DeviceIQ.deviceRequest(
                requestId,
                null,
                (data: any) => this.handleSuccess(data),
                (err: any) => this.handleError(err),
                null,
                null,
                DeviceIQ.createUniquenessObject(eventId, subEventId, null, null),
                DeviceIQ.createGeoObject(ISOCode, postalCode, null),
                null
            );
        } else {
            this.handleError({ errors: [{ error: 'DeviceIQ not initialized' }] });
        }
    }

    private handleSuccess(jsonData: any): void {
        const body = {
            token: this.params['token'],
            isQuesExist: this.params['isQuesExist'],
            tsData: jsonData,
            tsFingerPrintType: this.params['tsFingerPrintType'],
            grpId: this.params['grp_id'],
            jobId: this.params['jb_id'],
            allowDupSt: this.params['allowDupSt'],
            actualUrl: this.params['au']
        };

        this.surveyService.saveTrueSampleResponse(body).subscribe({
            next: (response: any) => {
                if (response.termURL) {
                    window.location.href = response.termURL;
                } else if (response.redirection) {
                    window.location.href = this.params['au'];
                } else {
                    this.handleTermination(response);
                }
            },
            error: (err) => {
                this.heading = 'Error';
                this.subHeading = 'Failed to save redirection response.';
                this.cdr.markForCheck();
            }
        });
    }

    private handleTermination(response: any): void {
        this.heading = 'Thank you for trying this survey.';
        this.subHeading = "We're sorry you couldn't finish this survey. Sometimes, surveys look for certain groups or interests, and you might not have been a perfect match.";
        this.cdr.markForCheck();

        const data = {
            S: 8,
            token: this.params['token'],
            reason: response.reason,
            jobId: parseInt(this.params['jb_id'], 10),
            supCode: this.params['supCode'] || "FEsupplier",
            grpId: parseInt(this.params['grp_id'], 10),
            PID: this.params['PID'] || "",
            isFraud: parseInt(response.isFraud)
        };

        this.surveyService.preSurveyTerminationInQA(data).subscribe({
            next: (res: any) => {
                if (res.url) {
                    setTimeout(() => window.location.href = res.url, 2000);
                }
            }
        });
    }

    private handleError(jsonData: any): void {
        this.heading = 'Error';
        this.subHeading = jsonData.errors?.[0]?.error || 'An unexpected error occurred during redirection.';
        this.cdr.markForCheck();

        // Log error to backend as legacy code does
        this.surveyService.saveTrueSampleResponse({
            token: this.params['token'],
            isQuesExist: this.params['isQuesExist'],
            tsData: jsonData,
            tsFingerPrintType: this.params['tsFingerPrintType'],
            actualUrl: this.params['au']
        }).subscribe();
    }
}
