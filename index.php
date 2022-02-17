<?php

$boot = function() {
    
    $indexContent = file_get_contents('index.html');
    
    $parts = explode('<!--#BOUNDARY_CONFIG#-->', $indexContent);
    
    if (count($parts) !== 3)	{
        die('ERROR: Cannot read index.html. Check if it contains two "#BOUNDARY_CONFIG#" markers inside XplayerConfig variable declaration. That part will be replaced with generated config');
    }
    
    
    
    $collections = [];
    $menu = [];

    // Read subdirs of /data
    $collections = array_diff(scandir('./data') ?? [], ['.', '..']); 

    // build menu
    foreach($collections as $collection)    {
        
    }
    
    
    $collectionConfig = [
        'image_default' => '',
        'image_filename_auto_ext' => '',
        'data_dir' => '',
        'collection_title' => 'TEST PHP',
        'tracks' => [],
    ];

    $parts[1] = '<script>' ."\n"
            . 'let XplayerConfig = '."\n"
            . json_encode($collectionConfig, JSON_PRETTY_PRINT)
            ."\n</script>";
    
    print implode('', $parts);

};
$boot();

