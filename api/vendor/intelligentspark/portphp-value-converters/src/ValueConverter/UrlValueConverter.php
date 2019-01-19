<?php

namespace IntelligentSpark\ValueConverter;

/**
 * Class UrlValueConverter
 * @package IntelligentSpark\ValueConverter
 */
class UrlValueConverter {

    public function __invoke($input)
    {
        //if we have an actual url without the http or s
        if(preg_match("/^([a-zA-Z0-9]+(\.[a-zA-Z0-9]+)+.*)$/",$input)==1) {
            return "http://" . $input;
        }elseif(preg_match("/(http|https):\/\//", $input)==1){
            //It's fine, it has all we need.
            return $input;
        }else{
            return '';  //it's not a valid url anyway, ignore it.
        }

    }

}

