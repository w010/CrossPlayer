/**
 * X Player / Cross Player
 * wolo.pl '.' studio
 * 2022
 * 
 * Webapp for presenting sets of similar audio tracks using parallel players and nice crossfading tools
 */
let Xplayer = {
    
    // currently active players
    instances: {
        'A': null, 'B': null, 'backtrack': null,
        // on load copy here first found item and make it hidden muted audioplayer, to use as time base.
        // we can't use any random from active players, because they can be removed and none of them is mandatory
        'time_base': null,
    },

    // current state of overall player (time base master)
    play_state: -1,  // -1 stopped, 0 paused, 1 playing

    // mainly information, in general we expect them all the same length
    duration: 0,

    // to make sure it already exist before reading value
    // todo later: move to VolumeControls?
    crossfaderReady: false,

    // configuration of current collection data
    config: {},


    /**
     * Set config, handle incoming/external json, set defaults
     * @param setup json
     */
    configure: (setup) => {
        if (typeof setup === 'undefined')
            setup = {};

        Xplayer.config = {
            image_default:      setup?.image_default  
                    ??  'assets/images/music-note-beamed_gray.svg',

                // use [audio filename].[this extension], as the image  
            image_filename_auto_ext:        setup?.image_filename_auto_ext 
                    ??     'jpg',

            collection_title:       setup?.collection_title
                    ??      'Default comparison',

            collection_description:       setup?.collection_description
                    ??      'Example collection, see README how to make own',

            // todo: auto trailing slash (now is required)
            data_dir:   setup?.data_dir
                    ??  './data/',

                // debug / advanced view
            dev:        setup?.dev
                    ??  false,

                // console show
            console_show:        setup?.console_show
                    ??  false,

                // start value
            crossfader_initial:     setup?.crossfader_initial
                    ??  -100,

            tracks:     setup?.tracks   
                    ?? [
                    /*{
                        // * FILE CONFIG REF:

                            // available values: 'A', 'B', 'backtrack'     // this is used to build '#container-instance-NNN' selector!
                        'load_as': 'backtrack',

                            // audio filename
                        'filename': '_player-test-drum.mp3',

                            // specify image filename explicitly, if not auto
                        'image': '_player-test-drum.png',
                        'image_absolute': '',

                            // track title
                        'title': 'Rhythm-drums',

                            // track description
                        'description': 'Lorem....',
                    },*/
            ],
        }
        App.logToConsole('CONFIG:', Xplayer.config, 'info');
        if (Xplayer.config.dev)
            $('body').addClass('dev-mode');

        return this;
    },


    initialize: () => {

        // Embed player instances
        Xplayer.config?.tracks.forEach((fileConf, i) => {
            Xplayer.loadTrack(i, fileConf);
        });

        // UI features

        // drag&drop
        Xplayer.initDraggable();
        Xplayer.initDroppable();

        //Utility.linkRangeInputs(':not(volume) input[type=range]');    // (omit volume manipulators - they link on their own)
        Xplayer.initFancyVolumes();
        Xplayer.initLogo();

        
        $('#collection_title').text(Xplayer.config.collection_title);
        $('#collection_description').append($('<p>'+ Xplayer.config.collection_description +'</p>'));

        // Bind globals


        // START
        $('#ctrl_play').click(e => {
            Xplayer.transportStart();
        });

        // PAUSE
        $('#ctrl_pause').click(e => {
            Xplayer.transportPause();
        });

        // STOP
        $('#ctrl_stop').click(e => {
            Xplayer.transportStop();
        });

        // REW
        $('#ctrl_rew').click(e => {
            Xplayer.transportRewind();
        });

        // FFWD
        $('#ctrl_ffwd').click(e => {
            Xplayer.transportFastForward();
        });

        $(document).on('keydown', e => {
            //console.log(e.keyCode);
            if (e.keyCode === 32) {     // space
                e.preventDefault();
                if (Xplayer.play_state === 1)   {
                    console.log('PAUSE');
                    Xplayer.transportPause();
                }
                else if (Xplayer.play_state < 1)   {
                    console.log('START');
                    Xplayer.transportStart();  
                }
            }
            if (e.keyCode === 27) {     // on escape key press - pause, if paused then stop
                if (Xplayer.play_state === 0)   {
                    Xplayer.transportStop();
                }
                else    {
                    Xplayer.transportPause();
                }
            }
        });



        let operatePanel = document.getElementById('operate-panel');
        let operatePanelPlaceholderUnpinned = document.getElementById('operate-panel-placeholder-unpinned');
        let operatePanelPlaceholderPinned = document.getElementById('operate-panel-placeholder-pinned');
        
        let _operatePanel_initialOffsetTop = operatePanel.offsetTop;
        let _operatePanel_pinState = false;


        $(window).on('scroll', e => {
            if (Xplayer.config.dev)     return;

            // control point (offset from top) - correction to make it stick earlier than it scroll away completely */
            // keep it here - window might be resized in the meantime, so calculate always
            // todo later: check in rwd
            let _operatePanel_scrollCheckpointCorrection = window.innerHeight / 3;

                // console.log('- el offset: ', _operatePanel_initialOffsetTop);
                // console.log('- checkpoint: ', _operatePanel_scrollCheckpointCorrection);
                // console.log('scroll Y: ', window.scrollY);
                // console.log('viewport: ', window.innerHeight);
                // check if seekbar showed in viewport, stick it to the page bottom
                // let pageScroll_isBelowSeekbarTopEdge = (timelineInitialOffsetTop - window.innerHeight - window.scrollY) < 0;

            // check if panel passed check point - is near [viewport's top edge  -  correction] 
            let pageScroll_operatePanelPassedControlPoint = (_operatePanel_initialOffsetTop - window.scrollY - _operatePanel_scrollCheckpointCorrection) < 0;


            // these heights are there for height transition - it needs a value to transit
            if (pageScroll_operatePanelPassedControlPoint === true  &&  _operatePanel_pinState === false) {
                _operatePanel_pinState = true;
                operatePanelPlaceholderUnpinned.style.height = operatePanelPlaceholderUnpinned.offsetHeight + 'px';
                operatePanelPlaceholderPinned.appendChild(operatePanel);
                document.body.classList.add('operate-panel-is-pinned');

            } else if (pageScroll_operatePanelPassedControlPoint === false  &&  _operatePanel_pinState === true) {
                _operatePanel_pinState = false;
                operatePanelPlaceholderPinned.style.height = operatePanelPlaceholderPinned.offsetHeight + 'px';
                operatePanelPlaceholderUnpinned.appendChild(operatePanel);
                document.body.classList.remove('operate-panel-is-pinned');
            } 
        });



        // TIMELINE / SEEK
        let timeline = $('#seek-slider');
        
        timeline.on('seek', e => {
            console.log('SEEK');
        });
        timeline.on('click', e => {
            // todo: check if ready
            
            let pos = e.pageX - timeline.offset().left; // Cursor position
            let percent = pos / timeline.width() * 100; // Width of element
            let cTime = Xplayer.duration ? (percent * Xplayer.duration / 100) : 0;

            if (Xplayer.instances?.time_base?.player[0])    {
                Xplayer.instances.time_base.player[0].currentTime = cTime;
            }
            if (Xplayer.instances?.A?.player[0])    {
                Xplayer.instances.A.player[0].currentTime = cTime;
            }
            if (Xplayer.instances?.B?.player[0])    {
                Xplayer.instances.B.player[0].currentTime = cTime;
            }
            if (Xplayer.instances?.backtrack?.player[0])    {
                Xplayer.instances.backtrack.player[0].currentTime = cTime;
            }
        });


        VolumeControls.initCrossfader({
                value: Xplayer.config.crossfader_initial,
            },
            (e, ui) => {
                Xplayer.crossfaderReady = true;
            },
        );


        $('.appversion').on('click', (e) => {
            // on triple click
            if (e.detail === 3) {
                $('body').toggleClass('dev-mode');
            }
        });

        //if (Xplayer.config.console_show)    {}



        // Nice analog display

        DigitAll.configure({
            valueDataKey: 'time',
            dev: Xplayer.config.dev,
        });
        DigitAll.initialize({
            applyTo: '.digitall',
            listenUpdate: '.digitall.listenUpdate',
        });



        // Oldschool tape player animation - just for fun
        ReelTape.configure();
        ReelTape.initialize();
    },


    /**
     * Set one time value to all of the active players
     * @param time int/float
     */
    syncTime: (time) => {
        console.log('time sync. incoming val: ', time);
        time = parseFloat(time);
        
        if (time > Xplayer.duration)    {
            time = Xplayer.duration;
        }
        if (time < 0)    {
            time = 0;
        }
console.log('TIME FINAL: ', time);
        if (Xplayer.instances?.A?.player[0])    {
            Xplayer.instances.A.player[0].currentTime = time;
        }
        if (Xplayer.instances?.B?.player[0])    {
            Xplayer.instances.B.player[0].currentTime = time;
        }
        if (Xplayer.instances?.backtrack?.player[0])    {
            Xplayer.instances.backtrack.player[0].currentTime = time;
        }
    },

    /**
     * PLAYER: START
     */
    transportStart: () => {

        let el = $('#ctrl_play');
        el.blur();

        if (!Xplayer.instances?.time_base?.player[0])   {
            return console.log('Cannot start playing, no time base instance! No files found?');
        }

        ReelTape.start();
        $('body').addClass('playing').removeClass('paused stopped');
        Xplayer.play_state = 1;

        // todo later: check all (actually loaded to instances) if "canplay" first. if all of them are = start

        // always sync times
        Xplayer.syncTime(Xplayer.instances.time_base.player[0].currentTime);

        $.each(['time_base', 'A', 'B', 'backtrack'], (i, key) => {
            Xplayer.instances[key]?.player[0]?.play();
        });
    },


    /**
     * PLAYER: PAUSE
     */
    transportPause: () => {

        let el = $('#ctrl_pause');
        el.blur();

        // if player stopped
        if (Xplayer.play_state < 0)    {
            return;
        }
        // unpause, if paused
        if (Xplayer.play_state === 0) {
            Xplayer.transportStart();
        }
        else    {
            ReelTape.pause();
            $('body').addClass('paused').removeClass('stopped');
            Xplayer.play_state = 0;

            $.each(['time_base', 'A', 'B', 'backtrack'], (i, key) => {
                Xplayer.instances[key]?.player[0]?.pause();
            });
        }
    },


    /**
     * PLAYER: STOP
     */
    transportStop: () => {

        let el = $('#ctrl_stop');
        el.blur();

        ReelTape.stop();
        $('body').addClass('stopped').removeClass('playing paused');
        Xplayer.play_state = -1;

        $.each(['time_base', 'A', 'B', 'backtrack'], (i, key) => {
           if (Xplayer.instances[key]?.player[0])    {
                Xplayer.instances[key].player[0].currentTime = 0;
                Xplayer.instances[key].player[0].pause();
                Xplayer.instances[key].el.removeClass('state_playing state_paused');
            }
        });
    },


    /**
     * PLAYER: FORWARD / FFWD
     */
    transportFastForward: () => {
        console.log(Xplayer.instances.time_base.player[0].currentTime);
        Xplayer.syncTime(Xplayer.instances.time_base.player[0].currentTime + 5);
    },


    /**
     * PLAYER: REWIND
     */
    transportRewind: () => {
        console.log(Xplayer.instances.time_base.player[0].currentTime);
        console.log(Xplayer.instances.time_base.player[0].currentTime - 5);
        
        Xplayer.syncTime(Xplayer.instances.time_base.player[0].currentTime - 5);
    },


    /**
     * Take the track from the bottom list and put it into play slot using mouse.
     * Nice feature but not necessary for the player to be functional - if causes problems, disable
     */
    initDraggable: () => {
        /*$('#container-all-tracks')
            .sortable({
            });*/

        $('#container-all-tracks .play-item.track-selectable')
            .draggable({
                revert: true,
                snap: '.dropzone',
                //connectToSortable: '#container-all-tracks',
                scroll: true,
                scrollSensitivity: 100,
                scrollSpeed: 100,
                // helper: 'clone',
            });
    },


    /**
     * Track drop areas
     */
    initDroppable: () => {
        let dropConf = {
            accept: '.play-item.track-selectable',
            drop: (event, ui) => {
                let dropItem = $(ui.draggable);
                let dropZone = $(event.target);
                let dropZoneInstanceKey = dropZone.prop('id').replace('dropzone-', '');

                if (App.DEBUG > 1)    {
                    console.log('dropZoneInstanceKey: ' + dropZoneInstanceKey);
                    console.log(dropItem);
                    // console.log(event);
                    // console.log(ui);
                }

                if (App.DEBUG)    {
                    let title = $(dropItem).find('h4').text();
                    console.log('dropped into slot: ' + dropZoneInstanceKey + ' item with title: ' + title);
                }
                $(dropItem).find('.btn.play_as_'+dropZoneInstanceKey).click();
            }
        };

        $( "#dropzone-A" ).droppable(dropConf);
        $( "#dropzone-B" ).droppable(dropConf);
        $( "#dropzone-backtrack" ).droppable(dropConf);
    },


    initFancyVolumes: () => {
        VolumeControls.configure();
            // don't need to use autoinit here, only set global configuration, the rest will be done on item build/embed 
            //.initialize({/*applyTo: '.other-selector'*/});
    },


    /**
     * Set player volume, using percentage scale
     * @param volume int Volume as number 0 to 100
     * @param player? object|jQuery [optional] Player element
     * @param player_ident? string [optional] Instance of player by given identifier    // todo later, on use  
     */
    setPlayerVolumePercent: (volume, player, player_ident) => {
        // set player volume - it expects float between 0 and 1
        player[0].volume = Utility.forceNumberInScope(volume, 0, 100) / 100;
    },



    loadTrack: (i, fileConf) => {
        
        // check input data
        let filename = fileConf?.filename;
        if (!filename)  {
            console.error('ERROR IN FILE CONF! No filename set in config item', fileConf);
            return;
        }
        let title = fileConf?.title ?? 'untitled ' + i;
        let load_as = fileConf?.load_as ?? '';

        // take first item and make it global time base hidden master player
        if (i === 0)    {
            Xplayer.track_setReferenceInstance(fileConf, filename);
        }

        Xplayer.track_addSelectableItem(fileConf, filename, title)
        if (load_as)  {
            Xplayer.track_embedInstance(fileConf, filename, title, load_as);
        }
    },



    /**
     * TODO: try to merge with embedInstance, if not many differences
     * Insert and keep ref to the base time master hidden track, which rules them all
     * Should be called only once, but it doesn't control that by itself
     * @param fileConf
     * @param filename
     * @param callbackPlayerReady
     */
    track_setReferenceInstance: (fileConf, filename, callbackPlayerReady) => {
        
        if (typeof filename !== 'string'  ||  !filename)  {
            return console.error('No filename specified!', fileConf);
        }

        let container = $('#container-instance-timebase');
        if (!container) {
            return console.error('Container for host master / time base player cannot be determined - trying  #container-instance-timebase ');
        }
        if (typeof callbackPlayerReady !== 'function')  callbackPlayerReady = ()=>{};
        if (App.DEBUG > 1)  App.logToConsole('Track file load: REFERENCE', fileConf);   // todo: also in the other


        // set some values

        let audioFilenameParts = filename.split('.');
        let audioFileType = audioFilenameParts.length > 1 ? audioFilenameParts.pop() : 'mp3';
        let audioFilenameBase = audioFilenameParts.join('.');


        // build markup

        let el_player = $('<audio controls preload="auto" muted class="dev">')
                .append(
                    $('<source src="'+ Xplayer.config.data_dir +filename+'" type="audio/'+audioFileType+'">'));

        let el_header = $('<h3>').text('MASTER REFERENCE PLAYER');
        let el_header2 = $('<h5>').text(filename);

        // in general is not visible, but keep markup for dev display / debug purposes
        let instance_box = $('<div class="rounded-3 p-3  play-item  master-time">');

        instance_box.append(
            $('<div class="row">').append(
                $('<div class="col-12">').append(
                    el_header,
                    el_header2
                ),
                // $('<div class="col-2">'),
                // $('<div class="col-2">')
            ),
            el_player
        );


        // embed in dedicated hidden box

        container.append(instance_box);
        

        // store reference to use for timing globally

        Xplayer.instances.time_base = {
            'el': instance_box,
            'player': el_player,
        }



        // BIND PLAYER LISTENERS


        // check, to run callback only once
        let callbackCalled = false;
        el_player[0].addEventListener('canplay', () => {
            instance_box.removeClass('state_loading');
            //console.log('BASE TIME MASTER canplay');

            // link with global time controls
            // set overall common duration
            if (!Xplayer.duration)  {
                Xplayer.duration = el_player[0].duration;
                $('#time_duration').data('time', Utility.formatTime(Xplayer.duration))
                    .trigger('datachange');
            }
            
            if (callbackCalled === false)   {
                callbackPlayerReady(el_player[0], instance_box);
                callbackCalled = true;
            }
        });
        
        
        // update global time counter & progress bar while playing, always keep in sync with this item
        el_player[0].addEventListener('timeupdate', () => {
            // track time position 
            $('#time_position').data('time', Utility.formatTime(el_player[0].currentTime))
                    .trigger('datachange');
            
            // progress bar indicator
            const percentagePosition = (100 * el_player[0].currentTime) / el_player[0].duration;
            $('#seek-slider .progress-bar').css('width', percentagePosition+'%');
        });

        el_player[0].addEventListener('ended', () => {
            Xplayer.transportStop();
        });


        // finally bind other events if needed

    },



    /**
     * Add available item to track selector (doesn't init player, only makes buttons)
     * @param fileConf
     * @param filename
     * @param title
     */
    track_addSelectableItem: (fileConf, filename, title) => {

        if (typeof filename !== 'string'  ||  !filename)  {
            return console.error('No filename specified!', fileConf);
        }

        let container = $('#container-all-tracks');
        if (!container) {
            return console.error('Container for all tracks selector cannot be determined - #container-all-tracks ');
        }
        //if (typeof callback !== 'function')  callback = ()=>{};   // todo later: check & finish

        // set some values

        // let audioFilenameParts = filename.split('.');
        // let audioFileType = audioFilenameParts.length > 1 ? audioFilenameParts.pop() : 'mp3';
        // let audioFilenameBase = audioFilenameParts.join('.');
        let imagePath = Xplayer.imageDetermine(fileConf, filename);


        // build markup
        let el_header = $('<h4>').text(title);
        
        let play_as_A = $('<button class="btn btn-l btn-square  play_as_A" type="button"><b>A</b></button>');
        let play_as_B = $('<button class="btn btn-l btn-square  play_as_B" type="button"><b>B</b></button>');
        let play_as_backtrack = $('<button class="btn btn-l   play_as_backtrack" type="button"><b>backtrack</b></button>');
        
        let el_controls = $('<div class="controls  me-2  position-absolute  bottom-0  begin-0">')
                .append('<span class="small">Play as: &nbsp;</span>')
                .append(play_as_A)
                .append(play_as_B)
                .append(play_as_backtrack);

        let el_status = $('<div class="status"><span class="indicator"></span><p></p>')
                .append($('<p class="dev">').text(Xplayer.config.data_dir + filename));


        let instance_box = $('<div class="rounded-3 p-3  play-item  track-selectable">');
        let imageElement = Xplayer.imageElPrepare(imagePath);

        instance_box.append(
            $('<div class="row">').append(
                $('<div class="col-9  col-sm-9  col-md-8  col-lg-9  col-xxl-10  position-relative">').append(
                    el_header,
                    el_status,
                    $('<div class="w100  mb-5  d-block  d-md-none">'),      // todo: check if this actually helps anything || remove
                    el_controls
                ),
                $('<div class="col-3  col-sm-3  col-md-4  col-lg-3  col-xxl-2">').append(
                    imageElement
                ),
                //$('<div class="col-md-4">')
            )
        );
        

        // bind actions
        
        play_as_A.click(() => {
            Xplayer.track_embedInstance(fileConf, filename, title, 'A', (player) => {
                //console.log('CALLBACK - SYNC TIME & PLAY');
                Xplayer.transportStart();
            });
        });
        play_as_B.click(() => {
            Xplayer.track_embedInstance(fileConf, filename, title, 'B', (player) => {
                Xplayer.transportStart();
            });
        });
        play_as_backtrack.click(() => {
            Xplayer.track_embedInstance(fileConf, filename, title, 'backtrack', (player) => {
                Xplayer.transportStart();
            });
        });


        
        // add item to selector
        
        container.append(instance_box);
    },


    /**
     * Embed audio player in one of predefined containers (A, B, backtrack)
     * @param fileConf
     * @param filename
     * @param title
     * @param load_as - target container / item role ('A' = track A, 'B' = track B, or 'backtrack'). expected values must match .instances object keys
     * @param callbackPlayerReady
     */
    track_embedInstance: (fileConf, filename, title, load_as, callbackPlayerReady) => {

        if (typeof Xplayer.instances[load_as] === 'undefined')  {
            return console.error('Wrong load_as value ('+load_as+'). Only predefined container/role values are possible');
        }
        if (typeof filename !== 'string'  ||  !filename)  {
            return console.error('No filename specified!', fileConf);
        }
        
        let container = $('#container-instance-' + load_as);
        if (!container) {
            return console.error('Container for player cannot be determined - trying using "load_as" value ('+load_as+') - #container-instance-\' + load_as is called');
        }
        if (typeof callbackPlayerReady !== 'function')  callbackPlayerReady = ()=>{};


        // cleanup

        container.empty();
        Xplayer.instances[load_as] = null;


        // set some values

        let audioFilenameParts = filename.split('.');
        let audioFileType = audioFilenameParts.length > 1 ? audioFilenameParts.pop() : 'mp3';
        let audioFilenameBase = audioFilenameParts.join('.');
        let imagePath = Xplayer.imageDetermine(fileConf, audioFilenameBase, true);
        // todo later: get from conf.
        // remember that volumes of A and B might be overridden later here, though - when crossfader inits, will be recalculated,
        // based on its start value, if set. 
        let startVolume = 100;


        // build markup
        
        let el_player = $('<audio controls preload="auto" class="dev">')
                .append(
                    $('<source src="'+Xplayer.config.data_dir + filename+'" type="audio/'+audioFileType+'">'));

        let el_header = $('<h3>').text(title);
        
        let ctrl_mute = $('<button class="btn btn-l  btn-square  ctrl_track_mute" type="button" title="MUTE track">M</button>'); 
        let ctrl_solo = $('<button class="btn btn-l  btn-square  ctrl_track_solo" type="button" title="Track SOLO">S</button>'); 
        
        let el_controls = $('<div class="controls  me-2   position-absolute  bottom-0  begin-0">')
                .append(ctrl_mute)
                .append(ctrl_solo);

        let el_status = $('<div class="status"><span class="indicator"></span><p></p>')
                .append(
                        $('<p class="dev">').text(Xplayer.config.data_dir + filename));


        // fancy volume
        let el_volumectrl = $('<volume id="player_'+load_as+'" class="me-2  text-center   volume-ctrl  is-loading" data-type="RotaryPot">');


        // todo: jesli embed wywolany zostal gdy state bylo playing, to powinien striggerowac play i sync tempa


        let instance_box = $('<div class="rounded-3 p-3  play-item  player-active  state_loading">');
        let imageElement = Xplayer.imageElPrepare(imagePath);

        instance_box.append(
            $('<div class="row">').append(
                $('<div class="col-7  col-sm-6  col-md-7  col-lg-8  col-xl-7  position-relative">').append(
                    el_header,
                    el_status,
                    el_controls
                ),
                $('<div class="col-3  col-sm-3  col-md-3  col-lg-2  col-xl-3 ">').append(
                    imageElement
                ),
                $('<div class="col-2  col-sm-3  col-md-2  col-lg-2  col-xl-2">').append(
                    el_volumectrl
                )
            ),
            el_player
        );



        // embed

        container.append(instance_box);
        $('#dropzone-'+load_as).addClass('slot-connected');



        // init Fancy Volume (must be after embed) [todo: find out why exactly)

        el_volumectrl.vc_makeRotaryPot({
            value: startVolume,
            /*markupPrepareFunc: (identifier, manipulatorType, conf) => {
                return VolumeControls.prepareMarkupParts_VolumeCtrl(identifier, manipulatorType, conf);
            },*/
            /*markupBuildFunc: (el, preparedParts, conf) => {
                VolumeControls.buildMarkup_VolumeCtrl(el, preparedParts, conf);
            },*/
        });

        // set the player volume, when VolCtrl volume value has changed
        el_volumectrl.on('set_volume.vc.ctrl', (el, param_data) => {
            // value passed by the trigger
            Xplayer.setPlayerVolumePercent(param_data.volumeValue, el_player);
            VolumeControls.updateStyleVar(instance_box, '--vc-volume-factor', param_data.volumeValue);
        });

        // set starting value 
        Xplayer.setPlayerVolumePercent(startVolume, el_player);
        // set css var with volume, for styling calculations
        VolumeControls.updateStyleVar(instance_box, '--vc-volume-factor', startVolume);





        // on embed respect crossfader position

        // if crossfader is ready (usually when use button play as...)
        if (Xplayer.crossfaderReady)    {
            // reinit crossfader with its current val - it will handle volumes on A and B
            //faderValue = $('#crossfader-ab').slider( 'option', 'values')
            VolumeControls.setCrossfaderVolumeValue($('#crossfader-ab-value').val());
        }



        // store operational info
        
        Xplayer.instances[load_as] = {
            el: instance_box,
            player: el_player,
        };



        // BIND PLAYER LISTENERS


        // check, to run callback only once
        let callbackCalled = false;
        el_player.on('canplay', () => {
            instance_box.removeClass('state_loading');

            if (callbackCalled === false)   {
                callbackPlayerReady(el_player[0], instance_box);
                callbackCalled = true;
            }
        });

        

        el_player.on('play', () => {
            console.log('PLAY ' + load_as);
            instance_box.addClass('state_playing');
            instance_box.removeClass('state_paused');
        });

        el_player.on('pause', () => {
            // when time is 0 (might have been reset right now) treat as full stop
            // handle as it was a stop event
            if (!el_player[0].currentTime) {
                //console.log('STOP (from pause handler): ' + load_as);
                instance_box.removeClass('state_paused');    
            }
            else    {
                //console.log('PAUSE:' + load_as);
                instance_box.addClass('state_paused');
            }
        });



        // bind other events


        ctrl_mute.click(() => {
            if (el_player.prop('muted'))    {
                el_player.prop('muted', false);
                ctrl_mute.removeClass('active');
            }
            else    {
                el_player.prop('muted', true);
                ctrl_mute.addClass('active');
            }
        });
        
        ctrl_solo.click(() => {
            console.log('SOLO ' + load_as);
            
            // unmute
            if (ctrl_solo.hasClass('active'))   {
                // unmute all (todo: handle their possibly own mute state, respect it)
                Xplayer.instances?.A?.player.prop('muted', false);
                Xplayer.instances?.B?.player.prop('muted', false);
                Xplayer.instances?.backtrack?.player.prop('muted', false);
                ctrl_solo.removeClass('active')
            }
            else {
                // just mute all and then unmute this (TRY TO MUTE WITHOUT SETTING STATE MUTED)
                // todo: remove Solo state from them
                Xplayer.instances?.A?.player.prop('muted', true);
                Xplayer.instances?.B?.player.prop('muted', true);
                Xplayer.instances?.backtrack?.player.prop('muted', true);
                el_player.prop('muted', false);
                ctrl_solo.addClass('active')
            }
        });
        
  

        /* expected markup:
            <div class="rounded-3 p-3 play-item   [ ... ]">
                <div class="row">
                    <div class="col-md-5"><h4>Flame / G&amp;B / Bridge</h4>
                        <div class="status">
                            <span class="indicator"></span>
                            <p></p>
                        </div>
                        <div class="me-2 controls">
                            <button class="btn btn-l btn-square  ctrl_track_mute" type="button">M</button>
                            <button class="btn btn-l btn-square  ctrl_track_solo" type="button">S</button>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <img class="image  img-fluid" alt="img" height="80" src="#" style="display: inline-block; height: 80px; width: 80px; border: 1px solid red;"width="80">
                    </div>
                    <div class="col-md-4">
                        <div class="me-2">
                            <input id="volume_slider" max="100" type="range" value="100">
                        </div>
                    </div>
                </div>

                <audio class="dev" controls="" preload="auto">
                    <source src="_player-test-guitar.mp3" type="audio/mp3">
                </audio>
            </div>
        */
    },


    /**
     * Embed image media file - img or svg object
     */
    imageElPrepare: (mediaFilePath) => {
        let imageElement;
        if ( /\.svg$/.test(mediaFilePath) )   {
            imageElement = $('<object data="'+mediaFilePath+'" class="image  img-fluid">');
        }
        else    {
            imageElement = $('<img src="'+mediaFilePath+'" alt="img" class="image  img-fluid">');
        }
        return imageElement;
    },


    /**
     * Look for image path for track, using config values, defaults or track filename
     * @param fileConf obj
     * @param filenameLookup string
     * @param dontParseFilename bool
     * @return string
     */
    imageDetermine: (fileConf, filenameLookup, dontParseFilename) => {
        fileConf = fileConf ?? {};
        let xconf = Xplayer.config;

        if (!dontParseFilename)  {
            let filenameParts = filenameLookup.split('.');
            // pop must be called to remove original ext from array (if filename has at least one dot)
            let fileExt = filenameParts.length > 1 ? filenameParts.pop() : '';
            filenameLookup = filenameParts.join('.');
        }

        let imagePath =     // explicit image given 
                fileConf?.image_absolute    ??
                    (fileConf?.image
                        ?   xconf.data_dir + fileConf?.image
                        :   // auto filename ext set
                            (xconf.image_filename_auto_ext
                                ?   // compile image filename
                                    xconf.data_dir  + filenameLookup + '.'   + xconf.image_filename_auto_ext
                                :   // use default image
                                    xconf.image_default  ?? ''
                            )
                    );

        return imagePath;
    },



    initLogo: () => {
        let container = $('.appname-container');
        container.attr('title', 'what, never seen a broken neo sign?')

        // wrap each char in span
        let appName = container.find('.appname');
        let appNameText = appName.text();
        appName.empty();

        // make one random letter buzz/blink/flicker, like a broken neon
        let flickerCharNum = Utility.randomInt(appNameText.length);

        for (let t = 0; t < appNameText.length; t++) {
            let char = appNameText.charAt(t);
            let charWrapped = $('<span class="char">').text(char);
            if (flickerCharNum === t)   {
                charWrapped.addClass('flicker');
            }
            appName.append(
                charWrapped
            );
        }

        // duplicate whole appname element, to add another layer of text-shadow, stroke etc.
        container.find('.appname-wrap').clone().appendTo(container);

        // try to not call jquery selector in endless loop - collect needed elements to array and simply operate directly on that prepared set
        let flickeringItems = [];
        container.find('.flicker').each((i, el) => {
            let $el = $(el);
            $el.attr('id', 'flickering-item-'+ i);
            flickeringItems.push($el);
        });



        // endless loop - randomize animation class for that letter (both copies) 
        let flickerLoop = setInterval(() => {

            // animations are 1 to 4. lower the chance to draw one of them, by lowering scope's min 
            let minChance = -24, maxChance = 4;
            let flickerAnimationNum = Utility.randomInt(minChance, maxChance);

            // set that class to both copies!
            $(flickeringItems).each((i, $el) => {
                // reset
                if (flickerAnimationNum > 0)   {
                    $el.addClass('flicker'+flickerAnimationNum)
                        .removeClass('flicker-still');
                }
                else    {
                    $el.addClass('flicker-still')
                        .removeClass('flicker1 flicker2 flicker3 flicker4');
                }
            });
        }, 2000);
    },



    /**
     * Cli handlers for console
     * @return {{}}
     */
    cliCommands: () => {
        return {
            'reel': {
                    title: 'Call object method',
                    syntax: 'ReelTape METHOD [PARAM]...',
                    description: 'ReelTape.METHOD([PARAM]...) call',
                    callable: (params) => {
                        // todo later: handle object methods calling, like other
                        QConsole.collapse();
                        //ReelTape.configure();
                        ReelTape.runTester();
                        return {result: 'Reel Tape tester screen'};
                    },
            },

            'xplayer': {
                    title: 'Call object method',
                    syntax: 'Xplayer METHOD [PARAM]...',
                    description: 'Call Xplayer.METHOD([PARAM]...)',
                    callable: (params) => {
                        let objName = 'Xplayer';
                        let method = params[0];
                        let methodParams = params.slice(1);
                        //console.log(objName+' - params: ', params);
                        //console.log(methodParams);
                        if (!method) {
                            return {    result: objName+': no method specified!',    level: 'warning'     };
                        }
                        // todo: check: maybe we can fetch jsdoc prop or visibility details? try like in this object iteration loop */
                        // note, that method name is case sensitive!
                        if (typeof Xplayer[method] !== 'function') {
                            return {    result: objName+': cannot find method `'+method+'`',    level: 'error'     };
                        }
                        let evalCode = objName+'.' +method+'('+ methodParams.join(', ') + ')';
                        return QConsole.cliEvalCode(evalCode);
                    },
            },

            'god': {
                    title: '',
                    syntax: 'god',
                    description: '',
                    callable: (params) => {
                        return {result: 'Q3A splash'};
                    },
            },
        }
    },

    Test: (p1, p2, p3) => {
        console.log('--------CLI TEST');
        console.log(' 1st param: ', p1);
        console.log(' 2nd param: ', p2);
        console.log(' 3rd param: ', p3);
    },

    /**
     * Audio players synchronization monitoring
     */
    synchronizationMonitor: (conf) => {
        let refresh = conf?.refresh  ??  1000;
        // if exist - destroy
        let monitor = $('#sync_monitor');
        if (monitor.length) {
            // make use of the instances registry, to keep the sync state, to break loop when destroying monitor
            Xplayer.instances._sync_monitoring = false;
            return monitor.remove();
        }
        Xplayer.instances._sync_monitoring = true;

        let instances = {
            time_base: {
                target_value: $('<td id="monitor_value__time_base">'),
                target_diff: $('<td id="monitor_diff__time_base">'),
                currentTime: 0,
                diffTime: 0,
            },
            A: {
                target_value: $('<td id="monitor_value__A">'),
                target_diff: $('<td id="monitor_diff__A">'),
                currentTime: 0,
                diffTime: 0,
            },
            B: {
                target_value: $('<td id="monitor_value__B">'),
                target_diff: $('<td id="monitor_diff__B">'),
                currentTime: 0,
                diffTime: 0,
            },
            backtrack: {
                target_value: $('<td id="monitor_value__backtrack">'),
                target_diff: $('<td id="monitor_diff__backtrack">'),
                currentTime: 0,
                diffTime: 0,
            },
        };

        // build the viewer
        monitor = $('<div id="sync_monitor">').append(
            $('<table class="table_ table-dark_ table-borderless_">').append(
                $('<tr>').append(
                    $('<th>'),
                    $('<th>').text('time'),
                    $('<th>').text('base diff'),
                ),
                $('<tr>').append(
                    $('<td>').text('MASTER/BASE:'),
                    instances['time_base'].target_value.text('0'),
                    instances['time_base'].target_diff.text('0'),
                ),
                $('<tr>').append(
                    $('<td>').text('A:'),
                    instances['A'].target_value.text('0'),
                    instances['A'].target_diff.text('0'),
                ),
                $('<tr>').append(
                    $('<td>').text('B:'),
                    instances['B'].target_value.text('0'),
                    instances['B'].target_diff.text('0'),
                ),
                $('<tr>').append(
                    $('<td>').text('Backtrack:'),
                    instances['backtrack'].target_value.text('0'),
                    instances['backtrack'].target_diff.text('0'),
                ),
            ),
        ).appendTo(
            $('body')
        )
        .attr('title', 'Audio synchronization monitor')
        .draggable();


        // start monitoring - loop all players' time position, if state = playing
        let monitoringLoop = setInterval(() => {
            if (!Xplayer.instances?._sync_monitoring)   {
                console.log('Stopped monitoring. Exit loop.');
                return clearInterval(monitoringLoop);
            }
            if (Xplayer.play_state !== 1)   {
                return;
            }
            //console.log('------ REFRESH MONITOR');

            // first collect the values at once, with minimum effort,
            $.each(['time_base', 'A', 'B', 'backtrack'], (i, instanceKey) => {
                instances[instanceKey].currentTime = Xplayer.instances[instanceKey]?.player[0].currentTime;
            });

            // ...and then update at once - to get the times more accurate
            $.each(['time_base', 'A', 'B', 'backtrack'], (i, instanceKey) => {
                instances[instanceKey].target_value[0].innerHTML = instances[instanceKey].currentTime ?? 0;
                if (instanceKey !== 'time_base'  &&  instances[instanceKey].currentTime > 0)    {
                    instances[instanceKey].diffTime = (instances[instanceKey].currentTime - instances['time_base'].currentTime)
                        .toFixed(6);
                    instances[instanceKey].target_diff[0].innerHTML = instances[instanceKey].diffTime;
                }
            });
            // console.log(instances);
        }, refresh);
    },
};



