<?php

$boot = function() {

    /**
     * Replace subpart of given template, expects two boundaries for determine subpart
     * @param string $content
     * @param string $boundary
     * @param string $replacement
     * @return string
     */
    function subpartReplace(string $content, string $boundary, string $replacement): string   {
        $parts = explode($boundary, $content);

        if (count($parts) !== 3)	{
            die('ERROR: Cannot read template (index.html). Check if it contains two '.$boundary.' markers');
        }
        $parts[1] = $replacement;
        return implode('', $parts);
    }

    /**
     * Read js config files and try to parse as json
     * @param string $file
     * @return array
     */
    function readConfig($file): array {
        $content = file_get_contents($file);
        $content = str_replace('let XplayerConfig =', '', $content);
        $json = json_decode($content, true);
        return is_array($json) ? $json : [];
    }




    // init
    $template = file_get_contents('index.html');
    $dataDir = './data';
    $collections = [];
    $markupMenu = '';
    $current = 'default';


    // Read subdirs of /data
    $subdirs = array_diff(scandir($dataDir) ?? [], ['.', '..']); 

    foreach($subdirs as $subdir)    {
        // read config
        $collections[$subdir] = readConfig($dataDir.'/'.$subdir.'/config.js');
    }


    // set current configuration
    if (in_array($_GET['collection'], array_keys($collections)))    {
        $current = $_GET['collection'];
    }

    $collectionConfig = $collections[$current];


    // build menu part
    foreach($collections as $id => $collection)    {
        $classActive = $current === $id ? ' active' : '';
        $markupMenu .= '<li class="nav-item">
							<a class="nav-link'.$classActive.'" href="?collection='.$id.'">' . $collection['collection_title'] . '</a>
						</li>';
    }


    // build configuration part
    $markupConfig = '<script>' ."\n"
            . 'let XplayerConfig = '."\n"
            . json_encode($collectionConfig, JSON_PRETTY_PRINT)
            ."\n</script>";
    
    $finalContent = subpartReplace($template, '<!--#BOUNDARY_CONFIG#-->', $markupConfig);
    $finalContent = subpartReplace($finalContent, '<!--#BOUNDARY_MENU#-->', $markupMenu);

    print $finalContent;

};
$boot();

