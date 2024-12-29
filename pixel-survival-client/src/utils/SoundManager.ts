class SoundManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private isMuted: boolean = false;

  constructor() {
    // Initialize game sounds
    this.loadSound('collect', '/sounds/collect.mp3');
    this.loadSound('background', '/sounds/background.mp3');
    this.loadSound('low-resource', '/sounds/low-resource.mp3');
    this.loadSound('gameOver', '/sounds/game-over.mp3');
    this.loadSound('gameStart', '/sounds/game-start.mp3');
    this.loadSound('safe', '/sounds/safe.mp3');
    this.loadSound('danger', '/sounds/danger.mp3');
  }

  private loadSound(name: string, path: string) {
    const audio = new Audio(path);
    audio.preload = 'auto';
    this.sounds.set(name, audio);
  }

  play(soundName: string) {
    if (this.isMuted) return;

    const sound = this.sounds.get(soundName);
    if (sound) {
      sound.currentTime = 0; // Reset the audio to start
      sound.play().catch(e => console.log('Audio play failed:', e));
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  setMute(mute: boolean) {
    this.isMuted = mute;
  }
}

export const soundManager = new SoundManager(); 