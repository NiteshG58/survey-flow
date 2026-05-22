import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-loading-spinner',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div *ngIf="loading" class="spinner-overlay">
      <div class="spinner-container">
        <div class="line"></div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="line"></div>
        <div class="line"></div>
        <p class="loading-text">Loading...</p>
      </div>
    </div>
  `,
    styles: [`
    .spinner-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: #ffffff;
      z-index: 9999;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .spinner-container {
      text-align: center;
    }
    .line {
      background-color: #0d0d1b;
      height: 40px;
      width: 8px;
      margin: 0 2px;
      display: inline-block;
      animation: scale 1.2s infinite ease-in-out;
    }
    .line:nth-child(1) { animation-delay: -1.2s; }
    .line:nth-child(2) { animation-delay: -1.0s; }
    .line:nth-child(3) { animation-delay: -0.8s; }
    .line:nth-child(4) { animation-delay: -0.6s; }
    .line:nth-child(5) { animation-delay: -0.4s; }

    @keyframes scale {
      0%, 40%, 100% {
        transform: scaleY(0.4);
      }
      20% {
        transform: scaleY(1);
      }
    }
    .loading-text {
      font-size: 20px;
      color: black;
      margin-top: 10px;
      font-family: 'Open Sans', sans-serif;
    }
  `]
})
export class LoadingSpinnerComponent {
    @Input() loading: boolean = false;
}
