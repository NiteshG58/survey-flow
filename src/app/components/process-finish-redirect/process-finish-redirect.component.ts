import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-process-finish-redirect',
  standalone: true,
  template: `<p class="redirect-msg">Finalising… Please wait.</p>`,
  styles: [`.redirect-msg{font-size:1.2rem;text-align:center;margin-top:2rem;}`]
})
export class ProcessFinishRedirectComponent implements OnInit {
  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Preserve any query parameters that the backend attached (status, memberid, transactionid, etc.)
    const qp = this.route.snapshot.queryParams;
    const qs = Object.entries(qp)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const base = environment.prjSucRedUrl; // e.g. http://localhost:61258/processFinish?status=1&memberid=
    const finalUrl = qs ? `${base}${qs.startsWith('status') ? '&' : ''}${qs}` : base;

    // Hard navigation – leaves the SPA so the backend 302 runs and the legacy PHP view is shown.
    window.location.href = finalUrl;
  }
}
