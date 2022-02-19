

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

                // debug / advanced view
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
        Xplayer.writeToConsole('config:', Xplayer.config);
        if (Xplayer.config.dev)
            $('body').addClass('dev-mode');
    },


    initialize: () => {

        // Embed player instances
        Xplayer.config?.tracks.forEach((fileConf, i) => {
            Xplayer.loadFile(i, fileConf);
        });
        

        Xplayer.linkRangeInputs();
        Xplayer.initFancyVolumes();
        Xplayer.initAnimatedReel();
        
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
            if (e.keyCode === 192) {     // ` - open quake style console
                Xplayer.consoleToggle();
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
        
        
        Xplayer.initCrossfader();


        $('.appversion').bind('dblclick', () => {
            $('body').toggleClass('dev-mode');
        });

        if (Xplayer.config.console_show)    {
            $('#console').bind('dblclick', (e) => {
                Xplayer.consoleToggle();
            }).removeClass('hidden');
        }
    },

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

        $('#animated_reel').addClass('spin-playing').removeClass('spin-paused spin-stopped');
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
            $('#animated_reel').removeClass('spin-playing').addClass('spin-paused');
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

        $('#animated_reel').addClass('spin-stopped').removeClass('spin-playing spin-paused');
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


    initCrossfader: () => {
        $('#crossfader-ab').slider({
            range: 'min',
            min: -100,
            max: 100,
            value: Xplayer.config.crossfader_initial,
            animate: 'fast',
            classes: {
                'ui-slider': 'crossfader',
                'ui-slider-handle': 'fader-handle',
                'ui-slider-range': 'fader-range',
            },
            // change: () => {   // start: () => {   // stop: () => {
            create: () => {
                // reset and append some additional markup
                Xplayer.crossfaderReady = true;
                Xplayer.crossfaderSetValue(Xplayer.config.crossfader_initial);
                $('#crossfader-ab .fader-handle').append(
                    $('<span class="inner">'),
                    $('<span class="cut">')
                );
                
                // build scale
                (() => {
                    // scale STYLE A
                    // let divideTo = 32;
                    // let oversizeEvery_4 = 1.6;
                    // let oversizeEvery_2 = 1.2;
                    // let baseMarkHeight = 30;
                    
                    // scale STYLE B
                    let divideTo = 16;
                    let oversizeStep = 5;   // 5px each step 
                    let baseMarkHeight = 50;
                    
                    
                    let scale = $('.crossfader-wrap .scale');
                    // calculate offset in % instead of px! it works best and everywhere
                    let stepInPercent = 100 / divideTo;

                    for (let m=0; m<=divideTo; m++) {
                        let offsetInPercent = m * stepInPercent;
                        let cssHeight = baseMarkHeight;

                        // STYLE B
                        if (offsetInPercent < 50)   {
                            cssHeight = baseMarkHeight - (m * oversizeStep); 
                        }
                        else if (offsetInPercent > 50)   {
                            cssHeight = baseMarkHeight - ((divideTo - m)  * oversizeStep); 
                        }
                        
                            // STYLE A
                            /*if (!(m%2))   {
                                cssHeight = 'height: '+ (oversizeEvery_2 * baseMarkHeight) + 'px';
                            }
                            if (!(m%4))   {
                                cssHeight = 'height: '+ (oversizeEvery_4 * baseMarkHeight) + 'px';
                            }*/

                        $(scale).append(
                            $('<div class="markline" style="left: '+offsetInPercent+'%; height: '+cssHeight+'px;">')
                        );
                    }
                })();
                
            },
            slide: (e, ui) => {
                Xplayer.crossfaderSetValue(ui.value);
            },
        });
        
        // text input
        $('input#crossfader-ab-value').change(e => {
            // v1  // value = $(e.target).map(() => { return $(this).val(); })[0];
            // v2
            let value = $(e.target).prop('value');
            // v3 - doesn't work!  // value = $(e.target[0]).val());
            // v4  // value = $(e.target)[0].value;

            $('#crossfader-ab').slider( 'option', 'value', value);
        });
    },


    crossfaderSetValue: (value) => {

        value = parseInt(value);
        if (value > -4  &&  value < 4)    {
            value = 0;
        }
        $('#crossfader-ab-value').val(value);
        $('#crossfader-ab').slider( 'option', 'value', value);

        // apply changes to tracks volume balance
        $('#volume-slider_A')
            .val(Math.min(Math.max(100 - value, 0), 100))
            .trigger('change');

        $('#volume-slider_B')
            .val(Math.min(Math.max(100 + value, 0), 100))
            .trigger('change');
    },
    

    formatTime: (seconds) => {
        let durationMinutes = parseInt(seconds / 60, 10);
        let durationSeconds = parseInt(seconds % 60);
        return durationMinutes + ':' + durationSeconds.toString().padStart(2, '0');
    },
    
    
    initFancyVolumes: () => {
        $('.fancy-volume.is-loading').each( (i, el) => {
            let mainInput = $('#'+$(el).attr('id').replace('__fancy', ''));
            Xplayer.setFancyVolumeState(el, mainInput, $(mainInput)[0].value);
            $(el).removeClass('is-loading');
        });
    },
    
    
    setFancyVolumeState: (el, mainInput, value) => {
        
        let valuePercent = value ?? $(mainInput)[0].value;   // value
        if (valuePercent < 0)   {
            valuePercent = 0;
        }
        
        // I assume here, that every volume slider input has values 0-100 and that we can
        // here basically expect the percentage value. if you need to use it with other scope,
        // pass them and calculate valuePercent here using them.
        //let valuePercent = $(el).data('value');
        let minRotationAngle = 225;     // about 7:30
        let maxRotationAngle = 135;     // about 4:30
        let rotation = 'R';     // clockwise
        
        
        //console.log('%', valuePercent);
        // calculate degree between these min/max, respecting rotation dir
        if (rotation === 'R')   {
            let angleBetween = 360-minRotationAngle + maxRotationAngle;

            // calculate degree for incoming percent value
            let degreesFromPercentOfScope = angleBetween * valuePercent / 100;
            // but it's calculated according to 0! so we must go back by minrotation degrees
            let finalAngle = minRotationAngle + degreesFromPercentOfScope;
            if (finalAngle >= 360) {
                finalAngle = finalAngle - 360;
            }
            // console.log('DEG', degreesFromPercentOfScope);
            // console.log('finalAngle', finalAngle);
            // $(el).css("transform", 'rotate('+finalAngle+'deg);'});   // doesn't work. need this:
            $(el).css({ WebkitTransform: 'rotate(' + finalAngle + 'deg)'});
            

            // angle correction for box shadow
            
            let xOffset = 3;
            let yOffset = 2;
            let blurSpreadColor = '6px 0px #080808a6';
            let inset = false;

            let newOffset = convertOffset(xOffset, yOffset, finalAngle);
            $(el).css({boxShadow: (inset ? 'inset ' : '') + newOffset[0] + 'px ' + newOffset[1] + 'px ' + blurSpreadColor});
            $(el).find('.cut').css({boxShadow: (inset ? 'inset ' : '') + newOffset[0] + 'px ' + newOffset[1] + 'px ' + blurSpreadColor});
            
            function convertOffset(x, y, deg) {
                let radians = deg * Math.PI / 180;
                let sin = Math.sin(radians);
                let cos = Math.cos(radians);

                return [
                    Math.round((x * cos + y * sin) * 100) / 100,
                    Math.round((-x * sin + y * cos) * 100) / 100
                ];
            }
        }
    },

    
    initAnimatedReel: () => {
        // just for fun
        $('#animated_reel .power').on('dblclick', () => {
            $('#animated_reel').toggleClass('spin-playing').toggleClass('spin-stopped');
        });
    },


    /**
     * link range inputs with their text fields
     */
    linkRangeInputs: () => {
        $( 'input[type=range]' ).each( (i, el) => {
            // take range input and find its text input by id
            let range = $(el),
                text = $( '#' + range.prop('id').replace('__range', '') );
            text.on( 'keyup change', () => {
                // prevent typing beyond range's scope
                let value = Math.min(Math.max(text.val(), range.prop('min')), range.prop('max'));
                text.val( value );
                range.val( value );
                Xplayer.setFancyVolumeState($('#'+text.prop('id')+'__fancy'), text, value)
            });
            range.on( 'input change', () => {
                text.val( range.val() );
                text.trigger('change');
                Xplayer.setFancyVolumeState($('#'+text.prop('id')+'__fancy'), text, range.val())
            });
        });
    },


    loadFile: (i, fileConf) => {
        
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
                $('#time_duration').data('time', Xplayer.formatTime(Xplayer.duration))
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
            $('#time_position').data('time', Xplayer.formatTime(el_player[0].currentTime))
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
        if (typeof callback !== 'function')  callback = ()=>{};

        // set some values

        // let audioFilenameParts = filename.split('.');
        // let audioFileType = audioFilenameParts.length > 1 ? audioFilenameParts.pop() : 'mp3';
        // let audioFilenameBase = audioFilenameParts.join('.');
        let imagePath = Xplayer.imageDetermine(fileConf, filename);


        // build markup
        let el_header = $('<h4>').text(title);
        
        let play_as_a = $('<button class="btn btn-l btn-square  play_as_a" type="button"><b>A</b></button>');
        let play_as_b = $('<button class="btn btn-l btn-square  play_as_b" type="button"><b>B</b></button>');
        let play_as_backtrack = $('<button class="btn btn-l   play_as_backtrack" type="button"><b>backtrack</b></button>');
        
        let el_controls = $('<div class="controls  me-2  position-absolute  bottom-0  begin-0">')
                .append('<span class="small">Play as: &nbsp;</span>')
                .append(play_as_a)
                .append(play_as_b)
                .append(play_as_backtrack);

        let el_status = $('<div class="status"><span class="indicator"></span><p></p>')
                .append($('<p class="dev">').text(Xplayer.config.data_dir + filename));


        let instance_box = $('<div class="rounded-3 p-3  play-item  track-selectable">');
        let imageElement = Xplayer.imageElPrepare(imagePath);

        instance_box.append(
            $('<div class="row">').append(
                $('<div class="col-9  col-sm-9  col-md-8  col-lg-9  position-relative">').append(
                    el_header,
                    el_status,
                    $('<div class="w100  mb-5  d-block  d-md-none">'),      // todo: check if this actually helps anything || remove
                    el_controls
                ),
                $('<div class="col-3  col-sm-3  col-md-4  col-lg-3">').append(
                    imageElement
                ),
                //$('<div class="col-md-4">')
            )
        );
        

        // bind actions
        
        play_as_a.click(() => {
            Xplayer.track_embedInstance(fileConf, filename, title, 'A', (player) => {
                //console.log('CALLBACK - SYNC TIME & PLAY');
                Xplayer.transportStart();
            });
        });
        play_as_b.click(() => {
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

        container.find('.play-item').remove();
        Xplayer.instances[load_as] = null;


        // set some values

        let audioFilenameParts = filename.split('.');
        let audioFileType = audioFilenameParts.length > 1 ? audioFilenameParts.pop() : 'mp3';
        let audioFilenameBase = audioFilenameParts.join('.');
        let imagePath = Xplayer.imageDetermine(fileConf, audioFilenameBase, true);


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
        
        
        let ctrl_volume = $('<input type="range" id="volume-slider_'+load_as+'__range" class="dev" max="100" value="100">'); 
        let ctrl_volume_linked = $('<input type="text" id="volume-slider_'+load_as+'" class="range-text" value="100">'); 
        let ctrl_volume_fancy = $('<div id="volume-slider_'+load_as+'__fancy" class="fancy-volume is-loading"><span class="cut">'); 

        let el_controls_vol = $('<div class="me-2  text-end  ctrl-volume">')
                .append(
                        $('<div class="scale"><span class="line"></span><span class="line"></span></div>'),
                        $('<div class="rondo">'),   // bottom part of knob, above scale
                        ctrl_volume_fancy, ctrl_volume, ctrl_volume_linked);
        
        let el_status = $('<div class="status"><span class="indicator"></span><p></p>')
                .append($('<p class="dev">').text(Xplayer.config.data_dir + filename));
        
        
        
        ctrl_volume_linked.bind('input change', () => {
             let value = parseInt($(ctrl_volume_linked)[0].value);
             let volume = value ? Math.min(Math.max(value / 100, 0), 1) : 0;
             el_player[0].volume = volume;
        });

                        
                        ctrl_volume_fancy.bind('mousedown', (event) => {

                            let startY = event.clientY;

                            function handleMove(clientX, clientY) {
                                let deltaPx = startY - clientY;
                                
                                // without that check and unregistering listener also here, it sometimes doesn't run mouseup,
                                // (like, when released above audioplayer) and still handles move
                                if (document.body.matches(":active"))   {
                                    //console.log('== MOVE BY', deltaPx);

                                    // update value in related hidden input (and possibly all synced with it, like range)
                                    let mainInput = $('#'+ctrl_volume_fancy.attr('id').replace('__fancy', ''));
                                    let valueCurrent = $(mainInput)[0].value;

                                    // now from px distance calculate the value change. we cannot assume 1px = val change by 1, so estimate a modifier number to slow the responsibility a little
                                    let valUpdateSpeedReductionFactor = 0.05;
                                    let valueNew = parseInt(valueCurrent) + (deltaPx * valUpdateSpeedReductionFactor);
                                    
                                    valueNew = valueNew.toFixed(2);
                                    // console.log('valueNew', valueNew);
                                    //console.log('- VALUE CHANGE BY:', deltaPx * valUpdateSpeedReductionFactor);

                                    Xplayer.setFancyVolumeState(ctrl_volume_fancy, mainInput, valueNew);
                                    mainInput[0].value = valueNew;
                                    $(mainInput[0]).trigger('change');
                                    $(mainInput[0]).trigger('input');

                                    // reset calculation ref to current, to smoothen the behaviour
                                    if (valueNew >= 100 || valueNew <= 0) {
                                        startY = clientY;
                                    }
                                }
                                else    {
                                    document.removeEventListener('mousemove', onMouseMove);
                                    console.log('SHOULD UNREGISTER LISTENER');
                                }

                            }

                            function onMouseMove(event) {
                                event.preventDefault();
                                handleMove(event.clientX, event.clientY);
                            }

                            // track the distance and sync move with range input
                            document.addEventListener('mousemove', onMouseMove);

                            // mb released - finish - exit and unbind
                            document.onmouseup = function(e){
                                e.preventDefault();
                                console.log('MOUSE UP - clean MOUSEMOVE listener, EXIT');
                                document.removeEventListener('mousemove', onMouseMove);
                                //ctrl_volume_fancy[0].onmouseup = null;
                                // todo: this still hits on range drag.
                            };
                        });

        
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
                    el_controls_vol
                )
            ),
            el_player
        );

        
                
        // embed

        container.append(instance_box);

        Xplayer.linkRangeInputs();
        Xplayer.initFancyVolumes();

        // on embed respect crossfader position
        // if crossfader is ready (usually when use button play as...)
        if (Xplayer.crossfaderReady)    {
            // reinit crossfader with its current val - it will handle volumes on A and B
            //faderValue = $('#crossfader-ab').slider( 'option', 'values')
            Xplayer.crossfaderSetValue($('#crossfader-ab-value').val());
        }



        // store operational info
        
        Xplayer.instances[load_as] = {
            el: instance_box,
            player: el_player,
        };



        // BIND PLAYER LISTENERS


        // check, to run callback only once
        let callbackCalled = false;
        el_player[0].addEventListener('canplay', () => {
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
                            <input id="volume-slider" max="100" type="range" value="100">
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


    consoleToggle: () => {
        let console_custom = $('#console');
        console_custom.toggleClass('expand')
            .scrollTop(console_custom.prop('scrollHeight'));
    },


    writeToConsole: (log, data) => {
        let backtrace = (new Error().stack).replace(/^Error/, 'Trace:');
        let item;
        if (data)   {
            let dataDump = JSON.stringify(data, null, "\t");
            item = $('<pre class="item">').text(log + "\n" + (dataDump || '[cannot json.stringify variable]'));
        }
        else    {
            item = $('<div class="item">').text(log);
        }
        item.attr('title', backtrace);
        let console_custom = $('#console');
        console_custom.append(item);
        console_custom.scrollTop(console_custom.prop('scrollHeight'));
        if (data)   console.log(log, data)
        else        console.log(log)
    }
};



let XplayerNode = {

    /* node state - whether we can use or not */
    operating: false,

    /* node shorthand registry */
    n: {fs: null},

    config: {
        data_dir:   /*setup?.data_dir ??*/  './app/data/',
    },
    

    init: () => {
        if (typeof nw !== 'undefined')  {
            XplayerNode.operating = true;
            XplayerNode.n.fs = nw.require('fs');
            Xplayer.writeToConsole('NODE FOUND!');
        }
        else    {
            Xplayer.writeToConsole('NODE NOT PRESENT.');
        }
    },


    readConfigData: (callback) => {
        callback([]);
        return [];
        if (!XplayerNode.operating)     return [];
        Xplayer.writeToConsole ("- READ CONF START");

        let config = {};
        let userPreferences = {};

        // 1: Optionally, read [data]/userPreferences.json

//        let userPreferencesData = XplayerNode.readFile(XplayerNode.config.data_dir + 'userPreferences.json');
            Xplayer.writeToConsole('userPreferencesData', userPreferencesData);

        if (userPreferencesData) {
            // userPreferences = JSON.parse(userPreferencesData);
            // Xplayer.writeToConsole('userPreferences', userPreferences);
        }
        Xplayer.writeToConsole('userPreferences', userPreferences);
return;
        // 2: If present, read [data]/config.json

        let generalConfigData = XplayerNode.readFile(XplayerNode.config.data_dir + 'config.json');
        if (generalConfigData) {
            // todo: decide - if config.json found, we expect it has full config and nothing else is read?
            config = JSON.parse(generalConfigData);
            Xplayer.writeToConsole('config', config);
        }
        else {
            // 3: Scan data subdirs

            // iterate subdirs, try to read config.json / js if found, otherwise use: subdir as name, read file list
            XplayerNode.readDataSubdirs(XplayerNode.config.data_dir).forEach((subdir, i) => {
            
                alert (subdir);
                // todo: json structure fix
            });
        }

        config.prefs = userPreferences;
        callback(config);

        Xplayer.writeToConsole ("... config read finished."); 
    },


    
    readFile: (path) => {
        if (!XplayerNode.operating)     return;
        let content = '';
        //Xplayer.writeToConsole(' - path: ' + path);

        try {
            content = XplayerNode.n.fs.readFileSync(path, 'utf8');
        } catch (err) {
            Xplayer.writeToConsole('error: ' + err);
        }
        //Xplayer.writeToConsole(' - content: ' + content);
        //Xplayer.writeToConsole(' - content2: ', content);
        return content;
    },


    readDataSubdirs: (path) => {
        if (!XplayerNode.operating)     return;
        let subdirs = [];

        try {
            subdirs = XplayerNode.n.fs.readdirSync(path).map(fileName => {
                return path.join(path, fileName)
            })
            .filter(fileName => {
                return XplayerNode.n.fs.lstatSync(fileName).isDirectory()
            });
            
            Xplayer.writeToConsole(' - subdirs: ', subdirs);
            
        } catch (err) {
            Xplayer.writeToConsole('error: ' + err);
        }
        return subdirs;        
    }
};


// can be called beyond jq, not waiting for domready
XplayerNode.init();



(() => {
    'use strict'

    let boot = (incomingConfig) => {
        Xplayer.configure(incomingConfig);
        Xplayer.initialize();

        DigitAll.configure({
            valueDataKey: 'time',
            dev: Xplayer.config.dev,
        });
        DigitAll.initialize({
            applyTo: '.digitall',
            listenUpdate: '.digitall.listenUpdate',
        });
    }



    // if node has status: operating, it means we're in the app/standalone mode.
    // in such case, read configuration data using node filesystem tools and boot using it when ready.
    if (XplayerNode.operating)  {
        XplayerNode.readConfigData((readConfig) => {
            readConfig.console_show = true;
            readConfig.data_dir = readConfig.data_dir.replace('/^\.\/data/', './app/data/');
            Xplayer.writeToConsole(readConfig.data_dir);

            boot(readConfig);
        });
    }
    // otherwise - standard run
    else    {
        boot(XplayerConfig);
    }
})()
