import App = require("../../App");
import IBlock = require("../IBlock");
import Block = require("../Block");
import IModifier = require("../IModifier");
import Modifiable = require("../Modifiable");
import Grid = require("../../Grid");
import Source = require("./Source");
import Type = require("../BlockType");
import BlockType = Type.BlockType;
import Particle = require("../../Particle");

declare var RecorderJS;

class RecorderBlock extends Source {

    public Recorder: any;
    public RecordedAudio: Tone.Player;
    public BufferSource;
    public Filename: string;
    public RecordedBlob;

    constructor(grid: Grid, position: Point) {
        this.BlockType = BlockType.Recorder;

        super(grid, position);

        //TODO: WHEN RECORDING IT SHOULDN"T DUPLICATE THE

        this.Recorder = new Recorder(App.AudioMixer.Master, {
            workerPath: "Assets/Recorder/recorderWorker.js"
        });

        this.RecordedAudio = new Tone.Player();
        this.RecordedAudio.connect(this.Source);
        this.BufferSource = this.RecordedAudio.context.createBufferSource();

        this.RecordedAudio.setVolume(10);
        this.RecordedAudio.loop = true;

        this.Filename = "BlokdustRecording.wav";

        // Define Outline for HitTest
        this.Outline.push(new Point(-1, 0),new Point(0, -1),new Point(1, -1),new Point(2, 0),new Point(1, 1),new Point(0, 1));
    }

    Update() {
        super.Update();

    }

    Draw() {
        super.Draw();

        this.Grid.BlockSprites.Draw(this.Position,true,"recorder");
    }

    MouseDown() {
        super.MouseDown();
        this.StartRecording();
    }

    MouseUp() {
        super.MouseUp();
        this.StopRecording();
    }

    ParticleCollision(particle: Particle) {
        super.ParticleCollision(particle);

        particle.Dispose();
    }

    StartRecording() {
        this.Recorder.clear();
        console.log('STARTED RECORDING...');
        this.Recorder.record();
    }

    StopRecording() {
        this.Recorder.stop();
        this.RecordedAudio.stop();
        console.log('STOPPED RECORDING');
        this.SetBuffers();
    }

    StartPlayback() {
        this.RecordedAudio.start();
        console.log("STARTED PLAYBACK");
        console.log(this.GetRecordedBlob());
    }

    SetBuffers() {

        this.Recorder.getBuffers((buffers) => {

            this.BufferSource.buffer = this.RecordedAudio.context.createBuffer(1, buffers[0].length, 44100);
            this.BufferSource.buffer.getChannelData(0).set(buffers[0]);
            this.BufferSource.buffer.getChannelData(0).set(buffers[1]);

            this.RecordedAudio.setBuffer(this.BufferSource.buffer);

            this._OnBuffersReady();
        });
    }

    private _OnBuffersReady() {
        this.StartPlayback();
    }

    StopPlayback() {
        this.RecordedAudio.stop();
        console.log("STOPPED PLAYBACK");
    }

    GetRecordedBuffers() {
        return this.BufferSource.buffer;
    }

    GetRecordedBlob() {
        this.Recorder.exportWAV((blob) => {
            this.RecordedBlob = blob;
        });

        return this.RecordedBlob;
    }

    DownloadRecording() {
        this.Recorder.setupDownload(this.GetRecordedBlob(), this.Filename);
    }

    Delete(){
        super.Delete();

        this.RecordedAudio.stop();
        this.RecordedAudio.dispose();
        this.BufferSource = null;
        this.Recorder = null;
    }
}

export = RecorderBlock;