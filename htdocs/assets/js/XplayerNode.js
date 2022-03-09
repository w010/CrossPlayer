
/**
 * X player
 * Node.js compatibility layer, for use in standalone app mode
 * [WIP]
 */
let XplayerNode = {

    /* node state - whether we can use or not */
    operating: false,

    /* node shorthand registry */
    n: {fs: null},

    config: {
        data_dir:   /*setup?.data_dir ??*/  './app/data/',
    },
    

    tryToInit: () => {
        if (typeof nw !== 'undefined')  {
            XplayerNode.operating = true;
            XplayerNode.n.fs = nw.require('fs');
            Xplayer.writeToConsole('- node.js check:', 'FOUND!', 'info');
        }
        else    {
            Xplayer.writeToConsole('- node.js check:', 'not present.', 'info');
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



