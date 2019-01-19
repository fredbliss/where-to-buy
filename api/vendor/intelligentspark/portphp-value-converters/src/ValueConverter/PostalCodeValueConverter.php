<?php

namespace IntelligentSpark\ValueConverter;

/**
 * Class PostalCodeValueConverter
 * @package IntelligentSpark\ValueConverter
 */
class PostalCodeValueConverter {
    
    public function __invoke($input) {
        if((int)$input>1000 && (int)$input<9999)
            return "0".(string)(int)$input;
    }
}