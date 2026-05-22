import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-access-denied',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="denied-body">
      <div class="card col-md-8 block-center">
        <div class="card-content">
          <div class="card-title">
            <p>Invalid Request</p>
          </div>
          <div class="card-text">
            <p>Unfortunately, an issue has arisen, and we're unable to continue with the current request.</p>
          </div>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .denied-body {
      padding: 0;
      display: block;
      width: 100%;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      background: #ddd;
      font-family: Arial, Helvetica, sans-serif;
    }
    .card {
      background: #fff;
      display: block;
      padding: 20px;
      margin-top: 67px;
      border-radius: 8px;
      font-weight: 600;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      width: 650px;
      max-width: 90%;
      height: 170px;
      overflow: hidden;
    }
    .card-content {
      margin-top: 17px;
    }
    .card-title {
      color: #333;
      font-size: 26px;
      font-weight: 900;
      text-align: center;
      font-family: 'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif !important;
    }
    .card-text {
      color: #333;
      font-size: 21px;
      font-weight: 700;
      text-align: left;
    }
  `]
})
export class AccessDeniedComponent { }
