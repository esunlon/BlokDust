/// <reference path="./lib/exjs/dist/ex.d.ts"/>
import Config = require("./Config");
import Metrics = require("./AppMetrics");
import OperationManager = require("./Core/Operations/OperationManager");
import ResourceManager = require("./Core/Resources/ResourceManager");
import CommandManager = require("./Core/Commands/CommandManager");
import Audio = require("./Core/Audio/Audio");
import InputManager = require("./Core/Inputs/InputManager");
import TypingManager = require("./Core/Inputs/TypingManager");
import DragFileInputManager = require("./Core/Inputs/DragFileInputManager");
import KeyboardInput = require("./Core/Inputs/KeyboardInputManager");
import CommandsInputManager = require("./Core/Inputs/CommandsInputManager");
import PointerInputManager = require("./Core/Inputs/PointerInputManager");
import IEffect = require("./Blocks/IEffect");
import ISource = require("./Blocks/ISource");
import IBlock = require("./Blocks/IBlock");
import DisplayObjectCollection = require("./DisplayObjectCollection");
import Particle = require("./Particle");
import ColorThemes = require("./UI/ColorThemes");
import AnimationsLayer = require("./UI/AnimationsLayer");
import Serializer = require("./Serializer");
import Grid = require("./Grid");
import MainScene = require("./MainScene");
import Splash = require("./Splash");
import Commands = require("./Commands");
import CommandHandlerFactory = require("./Core/Resources/CommandHandlerFactory");
import CreateBlockCommandHandler = require("./CommandHandlers/CreateBlockCommandHandler");
import DeleteBlockCommandHandler = require("./CommandHandlers/DeleteBlockCommandHandler");
import MoveBlockCommandHandler = require("./CommandHandlers/MoveBlockCommandHandler");
import IncrementNumberCommandHandler = require("./CommandHandlers/IncrementNumberCommandHandler");
import SaveCommandHandler = require("./CommandHandlers/SaveCommandHandler");
import SaveAsCommandHandler = require("./CommandHandlers/SaveAsCommandHandler");
import LoadCommandHandler = require("./CommandHandlers/LoadCommandHandler");
import UndoCommandHandler = require("./CommandHandlers/UndoCommandHandler");
import RedoCommandHandler = require("./CommandHandlers/RedoCommandHandler");
import DisplayList = require("./DisplayList");
import Source = require("./Blocks/Source");
import Effect = require("./Blocks/Effect");
import IApp = require("./IApp");
import SaveFile = require("./SaveFile");
import FocusManager = require("./Core/Inputs/FocusManager");
import FocusManagerEventArgs = require("./Core/Inputs/FocusManagerEventArgs");
import PooledFactoryResource = require("./Core/Resources/PooledFactoryResource");
import ObservableCollection = Fayde.Collections.ObservableCollection;
import SketchSession = Fayde.Drawing.SketchSession;

class App implements IApp{

    private _Canvas: HTMLCanvasElement;
    private _ClockTimer: Fayde.ClockTimer = new Fayde.ClockTimer();
    private _SaveFile: SaveFile;
    public Unit: number;
    public GridSize: number;
    public ScaledUnit: number;
    public ScaledGridSize: number;
    public ZoomLevel: number;
    public DragOffset: Point;
    public ScaledDragOffset: Point;
    public Width: number;
    public Height: number;
    public Metrics: Metrics;
    public Audio: Audio = new Audio();
    public Blocks: IBlock[] = [];
    public MainScene: MainScene;
    public Scene: number;
    public CommandManager: CommandManager;
    public CommandsInputManager: CommandsInputManager;
    public FocusManager: FocusManager;
    public CompositionId: string;
    public Config: Config;
    public InputManager: InputManager;
    public TypingManager: TypingManager;
    public DragFileInputManager: DragFileInputManager;
    public KeyboardInput: KeyboardInput;
    public OperationManager: OperationManager;
    public Palette: string[] = [];
    public Particles: Particle[] = [];
    public ParticlesPool: PooledFactoryResource<Particle>;
    public PointerInputManager: PointerInputManager;
    public ResourceManager: ResourceManager;
    private _SessionId: string;
    private _FontsLoaded: number;
    public Color: ColorThemes;
    public Splash: Splash;
    public AnimationsLayer: AnimationsLayer;
    public LoadCued: boolean;
    public SubCanvas: HTMLCanvasElement[];

    // todo: move to BlockStore
    get Sources(): IBlock[] {
        return this.Blocks.en().where(b => b instanceof Source).toArray();
    }

    // todo: move to BlockStore
    get Effects(): IBlock[] {
        return this.Blocks.en().where(b => b instanceof Effect).toArray();
    }

    get SessionId(): string {
        return this._SessionId || localStorage.getItem(this.CompositionId);
    }

    set SessionId(value: string) {
        this._SessionId = value;
        localStorage.setItem(this.CompositionId, this._SessionId);
    }

    // todo: move to BlockStore
    public GetBlockId(): number {
        // loop through blocks to get max id
        var max = 0;

        for (var i = 0; i < this.Blocks.length; i++){
            var b = this.Blocks[i];
            if (b.Id > max){
                max = b.Id;
            }
        }

        return max + 1;
    }

    constructor(config: string) {
        this.Config = <Config>JSON.parse(config);
    }

    public Setup(){

        this.CreateCanvas();
        this.Scene = 0;

        this.SubCanvas = [];
        this.CreateSubCanvas(0); // optionsPanel

        // METRICS //
        this.Metrics = new Metrics();
        window.onresize = () => {
            this.Resize();
        }

        // LOAD FONTS AND SETUP CALLBACK //
        this.LoadCued = false;
        this._FontsLoaded = 0;
        var me = this;
        WebFont.load({
            custom: { families: ['Merriweather Sans:i3','Dosis:n2,n4']},
            fontactive: function (font,fvd) { me.FontsLoaded(font,fvd); },
            timeout: 3000 // 3 seconds
        });
        setTimeout(function () {
            me.FontsNotLoaded();
        },3020);


        // CREATE OPERATIONS MANAGERS //
        this.OperationManager = new OperationManager();
        this.OperationManager.MaxOperations = this.Config.MaxOperations;
        this.ResourceManager = new ResourceManager();
        this.CommandManager = new CommandManager(this.ResourceManager);

        // initialise core audio
        this.Audio.Init();

        // REGISTER COMMAND HANDLERS //
        this.ResourceManager.AddResource(new CommandHandlerFactory(Commands[Commands.CREATE_BLOCK], CreateBlockCommandHandler.prototype));
        this.ResourceManager.AddResource(new CommandHandlerFactory(Commands[Commands.DELETE_BLOCK], DeleteBlockCommandHandler.prototype));
        this.ResourceManager.AddResource(new CommandHandlerFactory(Commands[Commands.MOVE_BLOCK], MoveBlockCommandHandler.prototype));
        this.ResourceManager.AddResource(new CommandHandlerFactory(Commands[Commands.SAVE], SaveCommandHandler.prototype));
        this.ResourceManager.AddResource(new CommandHandlerFactory(Commands[Commands.SAVEAS], SaveAsCommandHandler.prototype));
        this.ResourceManager.AddResource(new CommandHandlerFactory(Commands[Commands.LOAD], LoadCommandHandler.prototype));
        this.ResourceManager.AddResource(new CommandHandlerFactory(Commands[Commands.UNDO], UndoCommandHandler.prototype));
        this.ResourceManager.AddResource(new CommandHandlerFactory(Commands[Commands.REDO], RedoCommandHandler.prototype));


        // CREATE INPUT MANAGERS //
        this.TypingManager = new TypingManager();
        this.DragFileInputManager = new DragFileInputManager();
        this.KeyboardInput = new KeyboardInput();
        this.CommandsInputManager = new CommandsInputManager(this.CommandManager);
        this.PointerInputManager = new PointerInputManager();
        this.FocusManager = new FocusManager();
        this.FocusManager.FocusChanged.on((s: any, e: FocusManagerEventArgs) => {
            if (!e.HasFocus){
                this.CommandsInputManager.ClearKeysDown();
            }
        }, this);

        this.ParticlesPool = new PooledFactoryResource<Particle>(10, 100, Particle.prototype);

        // LOAD PALETTE //
        this.Color = new ColorThemes;
        this.Color.Init(this);
        this.Color.LoadTheme(0,true);

        // SOUNDCLOUD INIT //
        // todo: create server-side session
        if (typeof(SC) !== "undefined"){
            SC.initialize({
                client_id: this.Config.SoundCloudClientId
            });
        }

        // CREATE SPLASH SCREEN //
        this.Splash = new Splash;
        this.Splash.Init(this);
        this.AnimationsLayer = new AnimationsLayer;
        this.AnimationsLayer.Init(this);
    }

    // FONT LOAD CALLBACK //
    FontsLoaded(font,fvd) {
        this._FontsLoaded += 1;
        // All fonts are present - load scene
        if (this._FontsLoaded==3) {
            this.LoadReady();
        }
    }

    // FONT FAILURE TIMEOUT //
    FontsNotLoaded() {
        if (this._FontsLoaded !== 3) {
            console.log("FONTS ARE MISSING");
            // proceed anyway for now
            this.LoadReady();
        }
    }

    // PROCEED WHEN ALL SOCKETS LOADED //
    LoadReady() {
        if (this._FontsLoaded === 3 && this.Color.Loaded) {
            this.LoadComposition();
            this.Scene = 1;
            this.Splash.StartTween();
            var me = this;
        }
    }

    // IF LOADING A SHARE URL, GET THE DATA //
    LoadComposition() {
        this.CompositionId = Utils.Urls.GetQuerystringParameter('c');
        if(this.CompositionId) {
            this.CommandManager.ExecuteCommand(Commands[Commands.LOAD], this.CompositionId).then((data) => {
                this.PopulateSketch(data);
            }).catch((error: string) => {
                // fail silently
                this.CompositionId = null;
                this.Splash.LoadOffset = 1;
                console.log(error);
            });
        } else {
            this.Splash.LoadOffset = 1; // TODO should delete Splash once definitely done with it
        }
        this.CreateBlockSketch();
    }


    // CREATE MainScene & BEGIN DRAWING/ANIMATING //
    CreateBlockSketch() {
        // create MainScene
        this.MainScene = new MainScene();
        this.Blocks = [];

        // add blocks to MainScene DisplayList
        var d = new DisplayObjectCollection();
        d.AddRange(this.Blocks);
        this.MainScene.DisplayList = new DisplayList(d);

        // set up animation loop
        this._ClockTimer.RegisterTimer(this);

        this.Resize();
    }

    // IF LOADING FROM SHARE URL, SET UP ALL BLOCKS //
    PopulateSketch(data) {
        // get deserialized blocks tree, then "flatten" so that all blocks are in an array
        this.Deserialize(data);

        // set initial zoom level/position
        if (this._SaveFile.ColorThemeNo) {
            this.Color.LoadTheme(this._SaveFile.ColorThemeNo,false);
        }
        this.ZoomLevel = this._SaveFile.ZoomLevel;
        this.DragOffset = new Point(this._SaveFile.DragOffset.x, this._SaveFile.DragOffset.y);
        this.MainScene.ZoomButtons.UpdateSlot(this.ZoomLevel);
        this.Metrics.UpdateGridScale();

        // initialise blocks (give them a ctx to draw to)
        this.Blocks.forEach((b: IBlock) => {
            b.Init(this.MainScene);
        });

        // add blocks to MainScene DisplayList
        var d = new DisplayObjectCollection();
        d.AddRange(this.Blocks);
        this.MainScene.DisplayList = new DisplayList(d);

        // bring down volume and validate blocks //
        this.Audio.Master.volume.value = -100;
        this.RefreshBlocks();
        this.MainScene.Pause();

        if (this.Scene < 2) {
            this.LoadCued = true;
        } else {
            this.MainScene.CompositionLoaded();
        }

    }

    // todo: move to BlockStore
    RefreshBlocks() {
        // refresh all Sources (reconnects Effects).
        this.Blocks.forEach((b: IBlock) => {
            b.Refresh();
        });
    }



    OnTicked (lastTime: number, nowTime: number) {
        this.MainScene.SketchSession = new SketchSession(this._Canvas, this._Canvas.width, this._Canvas.height, nowTime);
        this.Update();
        this.Draw();
    }

    Update() : void {
        if (this.Scene === 2) {
            this.MainScene.Update();
        }
        this.AnimationsLayer.Update();
    }

    Draw(): void {
        if (this.Scene === 2) {
            this.MainScene.Draw();
        }
        if (this.Scene > 0) {
            this.Splash.Draw();
        }
    }

    Serialize(): string {
        return Serializer.Serialize();
    }

    Deserialize(json: string): any {
        this._SaveFile = Serializer.Deserialize(json);
        this.Blocks = this._SaveFile.Composition.en().traverseUnique(block => (<IEffect>block).Connections || (<ISource>block).Connections).toArray();
        this.Blocks.sort((a: IBlock, b: IBlock) => {
            return a.ZIndex - b.ZIndex;
        });
    }


    Message(message?: string, options?: any) {
        this.MainScene.MessagePanel.NewMessage(message, options);
    }

    CreateCanvas() {
        this._Canvas = document.createElement("canvas");
        document.body.appendChild(this._Canvas);
    }

    get Canvas(): HTMLCanvasElement {
        return this._Canvas;
    }

    CreateSubCanvas(i) {
        this.SubCanvas[i] = document.createElement("canvas");
        document.body.appendChild(this.SubCanvas[i]);
    }



    //todo: typing as CanvasRenderingContext2D causes "Property 'fillStyle' is missing in type 'WebGLRenderingContext'"
    // upgrade to newer compiler (1.5) which has no error - requires gulp as grunt-typescript seemingly no longer supported
    get Ctx() {
        return this._Canvas.getContext("2d");
    }

    TrackEvent(category: string, action: string, label: string, value?: number): void{
        if (isNaN(value)){
            window.trackEvent(category, action, label);
        } else {
            window.trackEvent(category, action, label, value);
        }
    }

    TrackVariable(slot: number, name: string, value: string, scope: number): void{
        window.trackVariable(slot, name, value, scope);
    }

    Resize(): void {

        this.Metrics.Metrics();
        if (this.MainScene.OptionsPanel) {
            this.MainScene.SketchResize();
        }

    }

}

export = App;
