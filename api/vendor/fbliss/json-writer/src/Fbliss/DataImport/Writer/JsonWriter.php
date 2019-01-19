<?php

namespace Fbliss\DataImport\Writer;

/**
 * Writes to a CSV file
 */
class JsonWriter extends AbstractStreamWriter
{
    private $utf8Encoding = true;

    /**
     * Constructor
     *
     * @param resource $stream
     * @param bool     $utf8Encoding
     */
    public function __construct($stream = null, $utf8Encoding = true)
    {
        parent::__construct($stream);

        $this->utf8Encoding = $utf8Encoding;
    }

    /**
     * @inheritdoc
     */
    public function prepare()
    {
        if ($this->utf8Encoding) {
            fprintf($this->getStream(), chr(0xEF) . chr(0xBB) . chr(0xBF));
        }

        return $this;
    }

    /**
     * {@inheritdoc}
     */
    public function writeItem(array $item)
    {
        fwrite($this->getStream(), $item);

        return $this;
    }
}
