<?php

/**
 * This file is part of the Geocoder package.
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 *
 * @license    MIT License
 */

namespace GeocoderBulk\Provider;

#use Geocoder\Provider\MapQuestProvider;
use Geocoder\Exception\InvalidCredentialsException;
use Geocoder\HttpAdapter\HttpAdapterInterface;
use Geocoder\Exception\NoResultException;
use Geocoder\Exception\UnsupportedException;

/**
 * @author William Durand <william.durand1@gmail.com>
 */
class MapQuestProvider extends \Geocoder\Provider\MapQuestProvider implements \Geocoder\Provider\ProviderInterface
{
    /**
     * @var string
     */
    const OPEN_GEOCODE_ENDPOINT_URL = 'http://open.mapquestapi.com/geocoding/v1/batch?inFormat=json&outFormat=json&maxResults=%d&key=%s&thumbMaps=false%s';


    /**
     * @var string
     */
    const LICENSED_GEOCODE_ENDPOINT_URL = 'http://www.mapquestapi.com/geocoding/v1/batch?inFormat=json&outFormat=json&maxResults=%d&key=%s&thumbMaps=false%s';

    /**
     * @var string
     */
    private $apiKey = null;

    public function __construct(HttpAdapterInterface $adapter, $apiKey, $locale = null, $licensed = false)
    {
        parent::__construct($adapter, $locale);

        $this->apiKey = $apiKey;
        $this->licensed = $licensed;
    }
    /**
     * {@inheritDoc}
     */
    public function getGeocodedData($data)
    {
        // This API doesn't handle IPs
        if (filter_var($data, FILTER_VALIDATE_IP)) {
            throw new UnsupportedException('The MapQuestProvider does not support IP addresses.');
        }

        if (null === $this->apiKey) {
            throw new InvalidCredentialsException('No API Key provided.');
        }

        //$strAddresses = '&location='.implode("&location=",$data);
        $strJson = json_encode($data);

        //echo $strAddresses;
        if ($this->licensed) {
            $query = sprintf(self::LICENSED_GEOCODE_ENDPOINT_URL, $this->getMaxResults(), $this->apiKey, $strAddresses);
        } else {
            $query = sprintf(self::OPEN_GEOCODE_ENDPOINT_URL, $this->getMaxResults(), $this->apiKey, $strAddresses);
        }

        return $this->executeQuery($query);
    }

    /**
     * @param string $query
     *
     * @return array
     */
    protected function executeQuery($query)
    {
        $content = $this->getAdapter()->getContent($query);

        if (null === $content) {
            throw new NoResultException(sprintf('Could not execute query: %s', $query));
        }

        $json = json_decode($content, true);

        if (!isset($json['results']) || empty($json['results'])) {
            throw new NoResultException(sprintf('Could not find results for given query: %s', $query));
        }

        $locations = $json['results'];

        if (empty($locations)) {
            throw new NoResultException(sprintf('Could not find results for given query: %s', $query));
        }

        $results = array();

        foreach ($locations as $row) {

            $location = $row['locations'][0];

            if ($location['street'] || $location['postalCode'] || $location['adminArea5'] || $location['adminArea4'] || $location['adminArea3'] || $location['adminArea1']) {
                $results[] = array_merge($this->getDefaults(), array(
                    'latitude'      => $location['latLng']['lat'],
                    'longitude'     => $location['latLng']['lng'],
                    'streetName'    => $location['street'] ?: null,
                    'city'          => $location['adminArea5'] ?: null,
                    'zipcode'       => $location['postalCode'] ?: null,
                    'county'        => $location['adminArea4'] ?: null,
                    'region'        => $location['adminArea3'] ?: null,
                    'country'       => $location['adminArea1'] ?: null,
                ));
            }
        }

        if (empty($results)) {
            throw new NoResultException(sprintf('Could not find results for given query: %s', $query));
        }

        return $results;
    }

}