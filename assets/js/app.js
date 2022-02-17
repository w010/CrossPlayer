

let Xplayer = {
    
    // currently active players
    instances: {
        'A': null, 'B': null, 'backtrack': null,
        // on load copy here first found item and make it hidden muted audioplayer, to use as time base.
        // we can't use any random from active players, because they can be removed and none of them is mandatory
        'time_base': null,
    },

    // mainly information, in general we expect them all the same length
    duration: 0,

    // configuration of current collection data
    config: {},


    /**
     * Set config, handle incoming/external json, set defaults
     * @param setup json
     */
    configure: function(setup) {
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

            // todo: auto trailing slash (now is required)
            data_dir:   setup?.data_dir
                    ??  './data/',

            dev: false,

            // todo:
	        crossfader_initial: -100,

            tracks:     setup?.tracks   
                    ?? [
                    /*{
                        // * FILE CONFIG REF:   // todo: check & update

                            // available values: 'A', 'B', 'backtrack'     // this is used to build '#container-instance-NNN' selector!
                        'load_as': 'backtrack',

                            // audio filename
                        'filename': '_player-test-drum.mp3',

                            // specify image filename explicitly, if not auto
                        'image': '_player-test-drum.png',

                            // track title
                        'title': 'Rhythm-drums',

                            // track description
                        'description': 'Lorem....',
                    },*/
            ],
        }
        
        if (Xplayer.config.dev)
            $('body').addClass('dev_mode');
    },


    initialize: function() {
        
        //console.log(XplayerConfig);
        //console.log(Xplayer.config);
        Xplayer.configure(XplayerConfig);
        //console.log(Xplayer.config);

        // Embed player instances
        Xplayer.config?.tracks.forEach((fileConf, i) => {
            Xplayer.loadFile(i, fileConf);
        });
        

        Xplayer.linkRangeInputs();
        Xplayer.initFancyVolumes();
        Xplayer.initReelAnimation();
        
        $('#collection_title').text(' - ' + Xplayer.config.collection_title);

        // Bind globals
        // todo: make all these calls as foreach
        
        // START
        $('#ctrl_play').click((e) => {
            let el = $('#ctrl_play');
            el.addClass('active').blur();
            $('#ctrl_pause').removeClass('active');
            $('#animated_reel').addClass('playing').removeClass('stopped');
 
            // todo later: check all (actually loaded to instances) if "canplay" first. if all of them are = start

            // always sync times
            if (Xplayer.instances?.A?.player[0])    {
                Xplayer.instances.A.player[0].currentTime = Xplayer.instances.time_base.player[0].currentTime;
            }
            if (Xplayer.instances?.B?.player[0])    {
                Xplayer.instances.B.player[0].currentTime = Xplayer.instances.time_base.player[0].currentTime;
            }
            if (Xplayer.instances?.backtrack?.player[0])    {
                Xplayer.instances.backtrack.player[0].currentTime = Xplayer.instances.time_base.player[0].currentTime;
            }
            
            Xplayer.instances?.time_base?.player[0].play();
            Xplayer.instances?.A?.player[0].play();
            Xplayer.instances?.B?.player[0].play();
            Xplayer.instances?.backtrack?.player[0].play();
        });
        
        // PAUSE
        $('#ctrl_pause').click((e) => {
            let el = $('#ctrl_pause');
            el.blur();
            let button_play = $('#ctrl_play');
            if (!button_play.hasClass('active'))    {
                return;
            }
            // unpause, if paused and state is playing
            if (el.hasClass('active')) {
                button_play.click();
                el.removeClass('active');
            }
            else    {
                Xplayer.instances?.time_base?.player[0].pause();
                Xplayer.instances?.A?.player[0].pause();
                Xplayer.instances?.B?.player[0].pause();
                Xplayer.instances?.backtrack?.player[0].pause();
                el.addClass('active');
                $('#animated_reel').removeClass('playing');
            }
        });

        // STOP
        $('#ctrl_stop').click((e) => {
            let el = $('#ctrl_stop');
            el.blur();
            $('#ctrl_pause').removeClass('active');
            $('#ctrl_play').removeClass('active');
            $('#animated_reel').removeClass('playing').addClass('stopped');

            if (Xplayer.instances?.time_base?.player[0])    {
                Xplayer.instances.time_base.player[0].currentTime = 0;
                Xplayer.instances.time_base.player[0].pause();
                Xplayer.instances.time_base.el.removeClass('state_playing state_pause');
            }
            if (Xplayer.instances?.A?.player[0])    {
                Xplayer.instances.A.player[0].currentTime = 0;
                Xplayer.instances.A.player[0].pause();
                Xplayer.instances.A.el.removeClass('state_playing state_pause');
            }
            if (Xplayer.instances?.B?.player[0])    {
                Xplayer.instances.B.player[0].currentTime = 0;
                Xplayer.instances.B.player[0].pause();
                Xplayer.instances.B.el.removeClass('state_playing state_pause');
            }
            if (Xplayer.instances?.backtrack?.player[0])    {
                Xplayer.instances.backtrack.player[0].currentTime = 0;
                Xplayer.instances.backtrack.player[0].pause();
                Xplayer.instances.backtrack.el.removeClass('state_playing state_pause');
            }
        });
    
        
        $(document).on('keydown',function(e) {
            if (e.keyCode === 27) {     // on escape key press - pause
                $('#ctrl_pause').click();
            }
        });

        
        // TIMELINE / SEEK
        let timeline = $('#seek-slider');
        
        timeline.on('click', function(e) {
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
        
        
        $('#crossfader-ab').slider({
            range: 'min',
            min: -100,
            max: 100,
            value: 0,
            animate: 'fast',
            classes: {
                'ui-slider': 'crossfader',
                'ui-slider-handle': 'fader-handle',
                'ui-slider-range': 'fader-range',
            },
            // change: () => {   // start: () => {   // stop: () => {
            create: () => {
                // reset and append some additional markup
                $('#crossfader-ab-value').val(0);
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
                let value = parseInt(ui.value);
                if (ui.value > -4  &&  ui.value < 4)    {
                    value = 0;
                    $('#crossfader-ab').slider( 'option', 'value', 0);
                }
                $('#crossfader-ab-value').val(value);
                
                // apply changes to tracks volume balance

                $('#volume-slider_A')
                    .val(Math.min(Math.max(100 - value, 0), 100))
                    .trigger('change');

                $('#volume-slider_B')
                    .val(Math.min(Math.max(100 + value, 0), 100))
                    .trigger('change');
            },
        });
        
        // text input
        $('input#crossfader-ab-value').change((e) => {
            let value;
            
            // v1
            // value = $(e.target).map(function() {
            //     return $(this).val();
            // })[0];
            
            // v2
            value = $(e.target).prop('value');
            
            // v3 - doesn't work!
            // value = $(e.target[0]).val()); 
            
            // v4
            // value = $(e.target)[0].value;

            $('#crossfader-ab').slider( 'option', 'value', value);
        });
        
        $('.appversion').bind('dblclick', ()=>{
           $('body').toggleClass('dev-mode');
        });
    },
                
    
    loadFile: function(i, fileConf) {
        
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
            Xplayer.setReferenceInstance(fileConf, filename);
        }

        Xplayer.addSelectableItem(fileConf, filename, title)
        if (load_as)  {
            Xplayer.embedInstance(fileConf, filename, title, load_as);
        }
    },

    
    
    /**
     * Insert and keep ref to the base time master hidden track, which rules them all
     * Should be called only once, but doesn't control that by itself
     * @param fileConf
     * @param filename
     */
    setReferenceInstance: function(fileConf, filename) {
        
        if (typeof filename !== 'string'  ||  !filename)  {
            return console.error('No filename specified!', fileConf);
        }

        let container = $('#container-instance-timebase');

        // build markup
        let el_header = $('<h3>').text('MASTER REFERENCE PLAYER');
        let el_header2 = $('<h5>').text(filename);

        let el_player = $('<audio controls preload="auto" muted class="dev">')
                .append(
                    $('<source src="'+ Xplayer.config.data_dir +filename+'" type="audio/mp3">'));

        // in general is not visible, but keep markup for dev display / debug purposes
        let instance_box = $('<div class="rounded-3 p-3  play-item  master-time">');
        instance_box.append(
            $('<div class="row">').append(
                $('<div class="col-sm-5">').append(
                    el_header,
                    el_header2
                ),
                $('<div class="col-sm-3">')
                ,
                $('<div class="col-sm-4">')
            ),
            el_player
        );


        // embed in dedicated hidden box
        container
                .append(instance_box);
        

        // store reference to use for timing globally
        Xplayer.instances.time_base = {
            'el': instance_box,
            'player': el_player,
        }


        // link with global time controls
        el_player[0].addEventListener('canplay', () => {
            instance_box.removeClass('state_loading');
            //console.log('BASE TIME MASTER canplay');

            // set overall common duration
            if (!Xplayer.duration)  {
                Xplayer.duration = el_player[0].duration;
                $('#time_duration').text(Xplayer.formatTime(Xplayer.duration));
            }
        });
        
        
        // update global time counter & progress bar while playing, always keep in sync with this item
        el_player[0].addEventListener('timeupdate', () => {
            // track time position 
            $('#time_position').text(Xplayer.formatTime(el_player[0].currentTime));
            
            // progress bar indicator
            const percentagePosition = (100 * el_player[0].currentTime) / el_player[0].duration;
            $('#seek-slider .progress-bar').css('width', percentagePosition+'%');
        });

        el_player[0].addEventListener('ended', () => {
            $('#ctrl_stop').click();
        });
    },


    formatTime: function (seconds) {
        let durationMinutes = parseInt(seconds / 60, 10);
        let durationSeconds = parseInt(seconds % 60);
        return durationMinutes + ':' + durationSeconds.toString().padStart(2, '0');
    },
    
    
    initFancyVolumes: function () {
        $('.fancy-volume.state-loading').each( (i, el) => {
            let mainInput = $('#'+$(el).attr('id').replace('__fancy', ''));
            Xplayer.setFancyVolumeState(el, mainInput, $(mainInput)[0].value);
            $(el).removeClass('state-loading');
        });
    },
    
    
    setFancyVolumeState: function (el, mainInput, value) {
        
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

    
    initReelAnimation: function ()  {
        $('#animated_reel .power').on('dblclick', () => {
            $('#animated_reel').toggleClass('playing');
            $('#animated_reel').toggleClass('stopped');
        });
    },


    /**
     * link range inputs with their text fields
     */
    linkRangeInputs: function()    {
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
            range.on( 'input change', function(){
                text.val( range.val() );
                text.trigger('change');
                Xplayer.setFancyVolumeState($('#'+text.prop('id')+'__fancy'), text, range.val())
            });
        });
    },


    /**
     * Add available item to track selector (doesn't init player, only makes buttons)
     * @param fileConf
     * @param filename
     * @param title
     */
    addSelectableItem: function(fileConf, filename, title) {

        // build markup
        let el_header = $('<h4>').text(title);
        
        let play_as_a = $('<button class="btn btn-l   play_as_a" type="button"><b>A</b></button>');
        let play_as_b = $('<button class="btn btn-l   play_as_b" type="button"><b>B</b></button>');
        let play_as_backtrack = $('<button class="btn btn-l   play_as_backtrack" type="button"><b>backtrack</b></button>');
        
        let el_controls = $('<div class="controls  me-2">')
                .append('<span class="small">Play as: &nbsp;</span>')
                .append(play_as_a)
                .append(play_as_b)
                .append(play_as_backtrack);

        let el_status = $('<div class="status"><span class="indicator"></span><p></p>')
                .append($('<p class="dev">').text(Xplayer.config.data_dir + filename));

        let filenameBase = filename.split('.').slice(0, -1).join('.');
        let image =     // explicit image given 
                    fileConf?.image_absolute    ??
                        (fileConf?.image
                            ?   Xplayer.config.data_dir + fileConf?.image
                            :   // auto filename ext set
                                (Xplayer.config.image_filename_auto_ext
                                    ?   // compile image filename
                                        Xplayer.config.data_dir  + filenameBase + '.'   + Xplayer.config.image_filename_auto_ext
                                    :   // use default image
                                        Xplayer.config.image_default  ?? ''
                                )
                        );

        let instance_box = $('<div class="rounded-3 p-3  play-item  track-selectable">');
        instance_box.append(
            $('<div class="row">').append(
                $('<div class="col-sm-10  col-md-10">').append(
                    el_header,
                    el_status,
                    el_controls
                ),
                $('<div class="col-sm-2  col-md-2 text-end">').append(
                    $('<img src="'+image+'" alt="img" class="img-fluid">')
                ),
                //$('<div class="col-md-4">')
            )
        );
        

        // bind actions
        
        play_as_a.click(() => {
            Xplayer.embedInstance(fileConf, filename, title, 'A', (player) => {
                //console.log('CALLBACK - SYNC TIME & PLAY');
                $('#ctrl_play').click();
            });
        });
        play_as_b.click(() => {
            Xplayer.embedInstance(fileConf, filename, title, 'B', (player) => {
                $('#ctrl_play').click();
            });
        });
        play_as_backtrack.click(() => {
            Xplayer.embedInstance(fileConf, filename, title, 'backtrack', (player) => {
                $('#ctrl_play').click();
            });
        });


        
        // add item to selector
        
        $('#container-all-tracks')
                .append(instance_box);
    },


    /**
     * Embed audio player in one of predefined containers (A, B, backtrack)
     * @param fileConf
     * @param filename
     * @param title
     * @param load_as - target container / item role ('A' = track A, 'B' = track B, or 'backtrack'). expected values must match .instances object keys
     * @param callback
     */
    embedInstance: function(fileConf, filename, title, load_as, callback) {

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
        if (typeof callback !== 'function')  callback = ()=>{};

        // cleanup

        container.find('.play-item').remove();
        Xplayer.instances[load_as] = null;

        // set some values

        let filenameBase = filename.split('.').slice(0, -1).join('.');
        let image =     // explicit image given 
                    fileConf?.image_absolute    ??
                        (fileConf?.image
                            ?   Xplayer.config.data_dir + fileConf?.image
                            :   // auto filename ext set
                                (Xplayer.config.image_filename_auto_ext
                                    ?   // compile image filename
                                        Xplayer.config.data_dir  + filenameBase + '.'   + Xplayer.config.image_filename_auto_ext
                                    :   // use default image
                                        Xplayer.config.image_default  ?? ''
                                )
                        );

        // build markup
        
        let el_player = $('<audio controls preload="auto" class="dev">')
                .append(
                    $('<source src="'+Xplayer.config.data_dir + filename+'" type="audio/mp3">'));

        let el_header = $('<h3>').text(title);
        
        let ctrl_mute = $('<button class="btn btn-l  ctrl_track_mute" type="button" title="MUTE track">M</button>'); 
        let ctrl_solo = $('<button class="btn btn-l  ctrl_track_solo" type="button" title="Track SOLO">S</button>'); 
        
        let el_controls = $('<div class="controls  me-2">')
                .append(ctrl_mute)
                .append(ctrl_solo);
        
        
        let ctrl_volume = $('<input type="range" id="volume-slider_'+load_as+'__range" class="dev" max="100" value="100">'); 
        let ctrl_volume_linked = $('<input type="text" id="volume-slider_'+load_as+'" class="range-text" value="100">'); 
        let ctrl_volume_fancy = $('<div id="volume-slider_'+load_as+'__fancy" class="fancy-volume state-loading"><span class="cut">'); 

        let el_controls2 = $('<div class="me-2  text-end  ctrl-volume">')
                .append(ctrl_volume_fancy, ctrl_volume, ctrl_volume_linked, $('<div class="scale">'));
        
        let el_status = $('<div class="status"><span class="indicator"></span><p></p>')
                .append($('<p class="dev">').text(Xplayer.config.data_dir + filename));
        
        
        
        ctrl_volume_linked.bind('input change', function (){
             let value = parseInt($(ctrl_volume_linked)[0].value);
             let volume = value ? Math.min(Math.max(value / 100, 0), 1) : 0;
             el_player[0].volume = volume;
        });

                        
                        ctrl_volume_fancy.bind('mousedown', function(event)  {

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
        instance_box.append(
            $('<div class="row">').append(
                $('<div class="col-sm-8  col-md-8">').append(
                    el_header,
                    el_status,
                    el_controls
                ),
                $('<div class="col-sm-2  col-md-2  text-begin   text-endxxxx">').append(
                    $('<img src="'+image+'" alt="img" class="img-fluid">')
                ),
                $('<div class="col-sm-2  col-md-2">').append(
                    el_controls2
                )
            ),
            el_player
        );


        // bind actions
        
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

        el_player.on('play', () => {
            console.log('PLAY ' + load_as);
            instance_box.addClass('state_playing');
            instance_box.removeClass('state_pause');
        });

        el_player.on('pause', () => {
            // when time is 0 (might have been reset right now) treat as full stop
            // handle as it was a stop event
            if (!el_player[0].currentTime) {
                console.log('STOP (from pause handler): ' + load_as);
                instance_box.removeClass('state_pause');    
            }
            else    {
                console.log('PAUSE:' + load_as);
                instance_box.addClass('state_pause');
            }
        });

        // we must check, to run it only once
        let callbackCalled = false;
        el_player[0].addEventListener('canplay', function() {
            instance_box.removeClass('state_loading');

            if (callbackCalled === false)   {
                callback(el_player[0], instance_box);
                callbackCalled = true;
            }
        });

        
        // embed

        container.append(instance_box);
        Xplayer.linkRangeInputs();
        Xplayer.initFancyVolumes();

        
        // store operational info
        
        Xplayer.instances[load_as] = {
            el: instance_box,
            player: el_player,
                //play_state: -1,   // -1 stop, 0 pause, 1 play
        };
        
        
  

        /* expected markup:
            <div class="rounded-3 p-3 play-item   [ ... ]">
                <div class="row">
                    <div class="col-md-5"><h4>Flame / G&amp;B / Bridge</h4>
                        <div class="status">
                            <span class="indicator"></span>
                            <p></p>
                        </div>
                        <div class="me-2 controls">
                            <button class="btn btn-l  ctrl_track_mute" type="button">M</button>
                            <button class="btn btn-l  ctrl_track_solo" type="button">S</button>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <img alt="img" height="80" src="#" style="display: inline-block; height: 80px; width: 80px; border: 1px solid red;"width="80">
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
};







(() => {
    'use strict'

    Xplayer.initialize();
})()
