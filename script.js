/**
 * Romantic Landing Page Interaction Logic
 */

// State Management
let isFilling = false;
let isFilled = false;
let clickCount = 0;
window.isColored = false; // Accessible by particle engine

// Sound Effects Engine using Web Audio API
class SoundEffects {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume context if suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playClick() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.12);
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc.start(now);
    osc.stop(now + 0.15);
  }

  startFillHum() {
    this.init();
    if (!this.ctx) return null;
    
    const now = this.ctx.currentTime;
    
    // Low warm detuned dual oscillators for chorus effect
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    
    osc1.frequency.setValueAtTime(110, now); // Low A2
    osc2.frequency.setValueAtTime(110.6, now); // Slight detune
    
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, now);
    
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.4);
    
    osc1.start(now);
    osc2.start(now);
    
    return { osc1, osc2, gain, filter };
  }

  updateFillHum(hum, progress) {
    if (!hum || !this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Smoothly open filter cutoff frequency as heart fills
    const cutoff = 180 + progress * 550; // Sweeps from 180Hz to 730Hz
    hum.filter.frequency.setTargetAtTime(cutoff, now, 0.1);
    
    // Pitch rises very subtly (a minor third scale)
    const baseFreq = 110 + progress * 20; // 110Hz to 130Hz
    hum.osc1.frequency.setTargetAtTime(baseFreq, now, 0.15);
    hum.osc2.frequency.setTargetAtTime(baseFreq + 0.6, now, 0.15);
  }

  stopFillHum(hum) {
    if (!hum || !this.ctx) return;
    const now = this.ctx.currentTime;
    hum.gain.gain.cancelScheduledValues(now);
    hum.gain.gain.setValueAtTime(hum.gain.gain.value, now);
    hum.gain.gain.linearRampToValueAtTime(0, now + 0.3);
    setTimeout(() => {
      try {
        hum.osc1.stop();
        hum.osc2.stop();
      } catch (e) {}
    }, 400);
  }

  playSuccessChord() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // Play a gorgeous, arpeggiated C-major 9th chord (C, G, C, E, B, D)
    const notes = [130.81, 196.00, 261.63, 329.63, 493.88, 587.33];
    
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      
      oscGain.gain.setValueAtTime(0, now);
      oscGain.gain.linearRampToValueAtTime(0.04, now + idx * 0.08 + 0.1);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 2.8 + idx * 0.1);
      
      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      
      osc.start(now + idx * 0.08);
      osc.stop(now + 3.5 + idx * 0.15);
    });
  }

  playGentleTap() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // High-pitched sweet bell chime
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.exponentialRampToValueAtTime(493.88, now + 0.35); // fall to B4
    
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.4);
  }
}

const sounds = new SoundEffects();

// Particle System Engine
const canvas = document.getElementById('particle-canvas') || document.getElementById('c') || document.querySelector('canvas');
const ctx = canvas ? canvas.getContext('2d') : null;

let particles = [];
const dustCount = 65;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

class Particle {
  constructor(type, x, y, options = {}) {
    this.type = type; // 'dust', 'sparkle', 'petal', 'heart'
    this.x = x;
    this.y = y;
    this.init(options);
  }

  init(options) {
    const angle = options.angle !== undefined ? options.angle : Math.random() * Math.PI * 2;
    const speed = options.speed !== undefined ? options.speed : Math.random() * 2 + 0.5;

    switch (this.type) {
      case 'dust':
        this.size = Math.random() * 1.6 + 0.4;
        this.vx = (Math.random() - 0.5) * 0.25;
        this.vy = -Math.random() * 0.35 - 0.15; // slow drift up
        this.alpha = Math.random() * 0.45 + 0.15;
        this.color = '#ffffff';
        break;

      case 'sparkle':
        this.size = Math.random() * 2.8 + 0.8;
        const s = speed * (Math.random() * 2.5 + 1);
        this.vx = Math.cos(angle) * s;
        this.vy = Math.sin(angle) * s - 0.4; // upward momentum
        this.alpha = 1.0;
        this.decay = Math.random() * 0.016 + 0.008;
        this.color = `hsl(${Math.random() * 25 + 340}, 100%, 78%)`; // Soft pastel pinks
        this.glow = true;
        break;

      case 'petal':
        this.size = Math.random() * 11 + 6;
        this.vx = (Math.random() - 0.5) * 0.8;
        this.vy = Math.random() * 0.7 + 0.6; // slow falling
        this.rotation = Math.random() * Math.PI * 2;
        this.rotSpeed = (Math.random() - 0.5) * 0.015;
        this.alpha = Math.random() * 0.5 + 0.35;
        this.decay = Math.random() * 0.002 + 0.001;
        this.color = `hsl(${Math.random() * 20 + 342}, 100%, ${Math.random() * 10 + 82}%)`;
        this.swaySpeed = Math.random() * 0.02 + 0.01;
        this.swayOffset = Math.random() * Math.PI * 2;
        break;

      case 'heart':
        this.size = Math.random() * 7 + 4;
        const hs = speed * (Math.random() * 1.8 + 0.8);
        this.vx = Math.cos(angle) * hs;
        this.vy = Math.sin(angle) * hs - 1.2; // float up faster
        this.alpha = 1.0;
        this.decay = Math.random() * 0.022 + 0.012;
        this.color = `hsl(${Math.random() * 22 + 344}, 100%, ${Math.random() * 20 + 60}%)`;
        break;
    }
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;

    if (this.type === 'dust') {
      // Wrap around screen
      if (this.y < -10) this.y = canvas.height + 10;
      if (this.x < -10) this.x = canvas.width + 10;
      if (this.x > canvas.width + 10) this.x = -10;

      // Slowly color transitions if page color changes
      if (window.isColored) {
        this.color = `hsl(${Math.random() * 30 + 340}, 100%, 88%)`;
        this.alpha = Math.min(this.alpha + 0.002, 0.6);
      }
    } else if (this.type === 'petal') {
      this.rotation += this.rotSpeed;
      // Add a nice side sway using sine waves
      this.x += Math.sin(this.y * this.swaySpeed + this.swayOffset) * 0.45;
      
      // Recycle petals at bottom
      if (this.y > canvas.height + 20) {
        this.y = -20;
        this.x = Math.random() * canvas.width;
        this.alpha = Math.random() * 0.5 + 0.35;
      }
    } else {
      this.alpha -= this.decay;
    }
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;

    if (this.type === 'heart') {
      ctx.translate(this.x, this.y);
      ctx.beginPath();
      const s = this.size;
      ctx.moveTo(0, s / 4);
      ctx.bezierCurveTo(0, -s / 2, -s, -s / 2, -s, s / 4);
      ctx.bezierCurveTo(-s, s, 0, s * 1.4, 0, s * 1.7);
      ctx.bezierCurveTo(0, s * 1.4, s, s, s, s / 4);
      ctx.bezierCurveTo(s, -s / 2, 0, -s / 2, 0, s / 4);
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = this.color;
      ctx.fill();
    } else if (this.type === 'petal') {
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.beginPath();
      ctx.ellipse(0, 0, this.size, this.size * 0.62, 0, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      // Add subtle petal shading
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.3, this.color);
      grad.addColorStop(1, `hsl(${Math.random() * 10 + 340}, 90%, 75%)`);
      ctx.fillStyle = grad;
      ctx.fill();
    } else {
      // Dust & Sparkles
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      if (this.glow) {
        ctx.shadowBlur = this.size * 3.5;
        ctx.shadowColor = this.color;
      }
      ctx.fill();
    }

    ctx.restore();
  }
}

// Populate ambient dust particles
for (let i = 0; i < dustCount; i++) {
  particles.push(new Particle('dust', Math.random() * canvas.width, Math.random() * canvas.height));
}

// Particle Burst generator
function triggerBurst(type, count, startX, startY, speedMultiplier = 1) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 2.5 + 0.5) * speedMultiplier;
    particles.push(new Particle(type, startX, startY, { angle, speed }));
  }
}

// Particle loop
function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Filter out expired particles (except dust & petals which stay)
  particles = particles.filter(p => p.type === 'dust' || p.type === 'petal' || p.alpha > 0);

  particles.forEach(p => {
    p.update();
    p.draw();
  });

  requestAnimationFrame(animateParticles);
}
animateParticles();

// Fluid wave height animation configuration
const heartTrigger = document.getElementById('heart-trigger') || document.getElementById('heartWrap') || document.querySelector('.heart-wrap');
const liquid = document.querySelector('.heart-liquid');
const liquidWave = document.querySelector('.liquid-wave');

// Click and Animation Logic
if (!heartTrigger) {
  console.warn('No heart trigger element found; click handler not attached.');
} else {
  heartTrigger.addEventListener('click', (e) => {
  if (isFilling) return;

  if (!isFilled) {
    clickCount = Math.min(clickCount + 1, 4);
    sounds.playClick();
    const fillLevel = clickCount / 4;
    const translateY = 512 - fillLevel * 512;
    if (liquid) liquid.style.transform = `translateY(${translateY}px)`;
    if (liquidWave) {
      liquidWave.style.setProperty('--liquid-translate', `${translateY}px`);
      liquidWave.style.transform = `translateY(${translateY}px)`;
      liquidWave.classList.remove('wave-bounce');
      void liquidWave.offsetWidth;
      liquidWave.classList.add('wave-bounce');
    }

    // Little sparkle burst each click
    const rect = heartTrigger.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    triggerBurst('sparkle', 12, centerX, centerY, 1.0);

    if (clickCount === 4) {
      isFilled = true;
      document.body.classList.add('is-filled-state');
      sounds.playSuccessChord();
      window.isColored = true;

      document.querySelector('#text-stage-1 .click-ray').classList.remove('animated');
      document.getElementById('text-stage-1').classList.remove('visible');
      setTimeout(() => {
        document.getElementById('text-stage-2').classList.add('visible');
        document.querySelector('#text-stage-2 .click-ray').classList.add('animated');
      }, 600);

      triggerBurst('sparkle', 120, centerX, centerY, 1.8);
      triggerBurst('heart', 30, centerX, centerY, 1.0);

      for (let i = 0; i < 20; i++) {
        particles.push(new Particle('petal', Math.random() * canvas.width, Math.random() * canvas.height * 0.7));
      }
    }
  } else {
    sounds.playGentleTap();

    heartTrigger.classList.remove('pulse-active');
    void heartTrigger.offsetWidth;
    heartTrigger.classList.add('pulse-active');

    const onPulseEnd = () => {
      heartTrigger.classList.remove('pulse-active');
      heartTrigger.removeEventListener('animationend', onPulseEnd);
    };
    heartTrigger.addEventListener('animationend', onPulseEnd);

    const clickX = e.clientX;
    const clickY = e.clientY;

    triggerBurst('heart', 12, clickX, clickY, 0.9);
    triggerBurst('sparkle', 20, clickX, clickY, 1.2);
    // After the pulse and particle bursts, navigate to the second page
    // Allow the pulse animation (0.7s) and bursts to play briefly before navigation
    setTimeout(() => {
      window.location.href = 'page2.html';
    }, 800);
  }
});
