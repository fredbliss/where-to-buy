<?php

/**
 * This file is part of the Geocoder package.
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 *
 * @license    MIT License
 */

namespace GeocoderBulk;

#use Geocoder\Provider\MapQuestProvider;
use Geocoder\Exception\InvalidCredentialsException;
use Geocoder\HttpAdapter\HttpAdapterInterface;
use Geocoder\Exception\NoResultException;
use Geocoder\Exception\UnsupportedException;

/**
 * @author William Durand <william.durand1@gmail.com>
 */
class Geocoder extends \Geocoder\Geocoder implements \Geocoder\GeocoderInterface
{

    /**
     * @var ProviderInterface[]
     */
    private $providers = array();

    /**
     * @var ProviderInterface
     */
    private $provider;

    /**
     * @var ResultFactoryInterface
     */
    private $resultFactory;

    /**
     * @var integer
     */
    private $maxResults;

    /**
     * {@inheritDoc}
     */
    public function geocode($data)
    {
        if (empty($data)) {
            // let's save a request
            return $this->returnResult(array());
        }

        $data = (is_string($data) ? trim($data) : $data);

        $provider = $this->getProvider()->setMaxResults($this->getMaxResults());

        $data = $provider->getGeocodedData($data);

        $result   = $this->returnResult($data);

        return $result;
    }

}