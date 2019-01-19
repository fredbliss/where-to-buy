<?php

require 'vendor/autoload.php';

use Port\Steps\StepAggregator;
use Port\Csv\CsvReader;
use Port\Steps\Step\ValueConverterStep;
use Port\Steps\Step\MappingStep;
use Port\Steps\Step\FilterStep;
use Port\Steps\Step\ValidatorStep;
use Port\Writer\CallbackWriter;
use Port\Filter\ValidatorFilter;
use Symfony\Component\Validator\Validation;
use Symfony\Component\Validator\Constraints as Assert;

use Aura\Sql\ExtendedPdo;

class ChartisApi {

    protected $app;

    protected $hosts = [];

    protected $indexbasename = 'locations';

    protected $alias = 'paconlocations';

    protected $client;

    protected $pdo;

    protected $debug = false;

    public function __construct() {
        $this->app = \Slim\Slim::getInstance();

        //append "test" onto the index name if this is in debug mode
        $this->indexbasename .= $this->debug===true ? '-test' : '';
        $this->alias .= $this->debug===true ? '-test' : '';

        $this->hosts = array (
            'https://paconwtb:mar70ley@0664c0c35f4255df000.qb0x.com:443'
        );

        $this->pdo = new ExtendedPdo(
            'mysql:host=localhost;dbname=pacon_sls',
            'pacon_sls',
            '57X~5;&ONF7i*~mV4A'
        );

        $this->client = Elasticsearch\ClientBuilder::create()
            ->setHosts($this->hosts)
            ->build();

        $this->setRoutes();
    }

    public function setRoutes() {
        $this->app->group('/locations', array($this,'groupLocations'));
        $this->app->group('/import',array($this,'groupImport'));
        $this->app->group('/scaffold',array($this,'groupScaffold'));
        $this->app->get('/ip',array($this,'getIPGeo'));
        $this->app->get('/getindex',array($this,'getIndexName'));
        #$this->app->get('/setindex',array($this,'setIndexName'));
        $this->app->get('/addalias',array($this,'addAlias'));
    }

    public function getIPGeo() {
        $this->app->response->setStatus(200);

        $this->app->response->header('Content-Type', 'application/json');

        echo file_get_contents('http://freegeoip.net/json/' . $_SERVER['REMOTE_ADDR']);
    }

    //scaffold elasticsearch
    public function groupScaffold() {


        $this->app->get('/locations',array($this,'putMapping'));

    }

    public function putMapping($strIndex) {

        $this->app->response->setStatus(200);

        $params = [
            'index' => $strIndex,
            'type'  => 'location',
            'body'    => [
                'location'  => [
                    'properties' => [
                        'categories'          => ['type' => 'string', 'index' => 'not_analyzed'],    //removes some unnecessary overhead
                        'customer_id'       => ['type' => 'string','index' => 'not_analyzed'],
                        'client'            => ['type' => 'string'],
                        'street'            => ['type' => 'string'],
                        'city'              => ['type' => 'string'],
                        'subdivision'       => ['type' => 'string'],
                        'postal'            => ['type' => 'string'],
                        'country'           => ['type' => 'string'],
                        'url'               => ['type' => 'string'],
                        'national'          => ['type' => 'boolean'],
                        'use_geospatial'    => ['type' => 'boolean'],
                        'catalog'           => ['type' => 'boolean'],
                        'online'            => ['type' => 'boolean'],
                        'location'            => ['type'=> 'geo_point']
                    ]
                ]
            ]
        ];

        #$this->client->indices()->create($params);
        $this->client->indices()->putMapping($params);

        $this->app->response->header('Content-Type', 'application/json');
    }

//locations
    public function groupLocations() {


        $this->app->get('/',array($this,'getLocations'));
        $this->app->get('/:id',array($this,'getLocation'));
        $this->app->options('/',array($this,'returnCORS'));
        $this->app->post('/',array($this,'submitLocation'));
    }

    public function getLocations() {


        $arrData = getAll('locations');

        $this->app->response->header('Content-Type', 'application/json');

        echo json_encode(array('success'=>true,'data'=>$arrData));
    }

    public function getLocation($id) {


        $this->app->response->header('Content-Type', 'application/json');

        echo json_encode(array(true));
    }

    public function submitLocation() {


        $data = json_decode($this->app->request->getBody(),true);


    }

    //import group
    public function groupImport() {
        $this->app->options('/',array($this,'returnCORS'));
        $this->app->post('/es',array($this,'postImportES'));
        $this->app->post('/mysql',array($this,'postImportMySQL'));
    }

    public function postImportMySQL() {

/*
        $this->app->response->setStatus(200);

        $arrFields = $arrRows = $arrCategories = array();

        $objFile = new \SplFileObject($_FILES['file']['tmp_name']);

        $reader = new ExcelReader($objFile,1);

        $reader->setHeaderRowNumber(1);

        $workflow = new Workflow($reader);

        $writerLocations = new CallbackWriter(function($row) use(&$arrFields, &$arrRows, &$arrCategories) {
            //index via chosen data source

        });

        $workflow
            ->addWriter($writerLocations)
            ->process();*/
    }

    public function postImportES() {
        $arrExceptionMsgs = array();
        $_SESSION['GEOCODE']['ERRORS'] = array();

        $this->app->response->setStatus(200);

        $arrFields = $arrRows = $arrCategories = array();

        $objFile = new \SplFileObject($_FILES['file']['tmp_name']);

        $reader = new CsvReader($objFile, ",");

        try {
            $reader->setHeaderRowNumber(0);
        }catch(Exception $e) {
            return json_encode(array("status" => "error", "errors" => array($e->getMessage())));
        }

        $workflow = new StepAggregator($reader);

        $writerLocations = new CallbackWriter(function($row) use(&$arrRows) {
            //index via chosen data source
            $arrRows[] = $row;

        });

        $converterStep = new ValueConverterStep();
        $converterStep->add('[general]', function($input) { return (bool)$input; });
        $converterStep->add('[retailer]', function($input) { return (bool)$input; });
        $converterStep->add('[catalog]', function($input) { return (bool)$input; });
        $converterStep->add('[online]', function($input) { return (bool)$input; });
        $converterStep->add('[url]', function($input) {
            //if we have an actual url without the http or s
            if(preg_match("/^([a-zA-Z0-9]+(\.[a-zA-Z0-9]+)+.*)$/",$input)==1) {
                return "http://" . $input;
            }elseif(preg_match("/(http|https):\/\//", $input)==1){
                //It's fine, it has all we need.
                return $input;
            }else{
                return '';  //it's not a valid url anyway, ignore it.
            }
        });
        $converterStep->add('[postal]', function($input) {
            if((int)$input>1000 && (int)$input<9999)
                return "0".(string)(int)$input;

            return $input;
        });

        $mappingStep = new MappingStep();

        /*
         * Website Category
            Customer_ID
            Customer_Name
            Customer_Street
            Customer_City
            Customer_State
            Customer_ZIP
            Customer_URL
            National Retailer
            By State/ZIP
            Catalog/Distributor
            Online Retailer
         */

        $mappingStep->map('[Website Category]','[categories]');
        $mappingStep->map('[Customer_ID]','[customer]');
        $mappingStep->map('[Customer_Name]','[client]');
        $mappingStep->map('[Customer_Street]','[street]');
        $mappingStep->map('[Customer_City]','[city]');
        $mappingStep->map('[Customer_State]','[subdivision]');
        $mappingStep->map('[Customer_ZIP]','[postal]');
        $mappingStep->map('[Customer_Country]','[country]');
        $mappingStep->map('[Customer_URL]','[url]');
        $mappingStep->map('[Catalog/Distributor]','[catalog]');
        $mappingStep->map('[Online Retailer]','[online]');
        $mappingStep->map('[General Retailer]','[general]');
        $mappingStep->map('[Retail Store]','[retailer]');

        $validator = Validation::createValidator();

        $filter = new ValidatorFilter($validator);
        $filter->throwExceptions();
        $filter->add('[categories]', new Assert\NotBlank());

        $result = $workflow
            ->addStep($mappingStep)
            ->addStep($converterStep)
            ->addWriter($writerLocations)
            ->process();


        if($result->getErrorCount()>0) {
            $arrExceptions = $result->getExceptions();

            foreach($arrExceptions as $exception) {
                $arrExceptionMsgs[] = $exception->getMessage();
            }

            return json_encode(array("status"=>"error","errors"=>$arrExceptionMsgs));
        }else{

            //condense all the duplicate locations to properly put categories into the tag format for ES
            $arrRowsCondensed = $this->condenseData($arrRows);

            //get the updated records with geocoding completed.
            $arrResults = $this->geocode($arrRowsCondensed);

            //$this->buildDataset($arrRowsCondensed);
            $this->buildDataset($arrResults);

            if(count($_SESSION['GEOCODE']['ERRORS'])) {
                return json_encode(array("status" => "error", "errors" => $_SESSION['GEOCODE']['ERRORS']));
            }else{
                return json_encode(array("status"=>"success"));
            }

        }

    }

    public function condenseData($arrData) {

        $arrCategories = array();

        foreach($arrData as $i=>$row) {

            $data = array_map('trim', $row);

            if (strlen($data['postal'])==0||strlen($data['street'])==0) {
                $strHashKey = md5(trim($data['url']));
            }else{
                $strHashKey = md5($data['street'].' '.$data['city'].', '.$data['subdivision'].' '.$data['postal']);
            }

            $arrCategories[$strHashKey][] = trim($row['categories']); //eliminated duplicates specifically for geocoding
        }

        $arrRows = array();

        //re-make the main data with categories and condensed unique rows.
        foreach($arrData as $i=>$row) {
            $data = array_map('trim', $row);

            if (strlen($data['postal'])==0||strlen($data['street'])==0) {

                $strHashKey = md5(trim($data['url']));
            }else{
                $strHashKey = md5($data['street'].' '.$data['city'].', '.$data['subdivision'].' '.$data['postal']);
            }

            $arrRows[$strHashKey] = $data;
            $arrRows[$strHashKey]['categories'] = $arrCategories[$strHashKey];

        }

        return $arrRows;
    }

    //Build any and all datasets
    public function buildDataset($arrDocs) {

        $arrMatches = $arrGeneral = $arrOnline = $arrCatalog = $arrRetailer = array();

        //we have to sort these rows based on what type of location, retailer, online, catalog.
        foreach($arrDocs as $i=>$doc) {

            if((bool)$doc['general']===true) {
                preg_match("/\d+/",(string)$doc['customer'],$arrMatches);

                $arrGeneral[$arrMatches[0]] = [
                    "general"   => $doc["general"],
                    "categories"   => $doc["categories"],
                    "city"   => $doc["city"],
                    "client"   => $doc["client"],
                    "location"   => $doc["location"],
                    "country"   => $doc["country"],
                    "national"   => $doc["national"],
                    "online"   => $doc["online"],
                    "postal"   => $doc["postal"],
                    "street"   => $doc["street"],
                    "subdivision"   => $doc["subdivision"],
                    "url"   => $doc["url"],
                    "use_geospatial"   => false //(isset($doc['postal']) ? true : false)
                ];
            }

            if((bool)$doc['online']===true) {
                preg_match("/(\d+)(.*)/",(integer)$doc['customer'],$arrMatches);

                $arrOnline[$arrMatches[0]] = [
                    "online"   => $doc["online"],
                    "categories"   => $doc["categories"],
                    "city"   => $doc["city"],
                    "client"   => $doc["client"],
                    "location"   => $doc["location"],
                    "country"   => $doc["country"],
                    "national"   => $doc["national"],
                    "online"   => $doc["online"],
                    "postal"   => $doc["postal"],
                    "street"   => $doc["street"],
                    "subdivision"   => $doc["subdivision"],
                    "url"   => $doc["url"],
                    "use_geospatial"   => false //(isset($doc['postal']) ? true : false)
                ];
            }

            if((bool)$doc['catalog']===true) {

                preg_match("/\d+/",(string)$doc['customer'],$arrMatches);

                $arrCatalog[$arrMatches[0]] = [
                    "catalog"   => $doc["catalog"],
                    "categories"   => $doc["categories"],
                    "city"   => $doc["city"],
                    "client"   => $doc["client"],
                    "location"   => $doc["location"],
                    "country"   => $doc["country"],
                    "national"   => $doc["national"],
                    "online"   => $doc["online"],
                    "postal"   => $doc["postal"],
                    "street"   => $doc["street"],
                    "subdivision"   => $doc["subdivision"],
                    "url"   => $doc["url"],
                    "use_geospatial"   => false//(isset($doc['postal']) ? true : false)
                ];

            }

            //collect and send to proper function for geospatial indexing process
            if((bool)$doc['retailer']===true) {

                $arrRetailer[] = $doc;
            }

        }

        //write the static files
        if(count($arrGeneral)) {
            $this->writeJsonFile('general.json',$arrGeneral);
        }

        if(count($arrOnline)) {
            $this->writeJsonFile('online.json',$arrOnline);
        }

        if(count($arrCatalog)) {
            $this->writeJsonFile('catalog.json',$arrCatalog);
        }

        //index in elasticsearch (for now)
        if(count($arrRetailer)) {
            //TODO: Send to proper storage medium based on variable set in api call?
            $strOldIndex = $this->getExistingIndex();

            $strNewIndex = $this->indexbasename.'_'.time();

            $this->createIndex($strNewIndex);
            $this->putDocuments($strNewIndex,$arrRetailer);
            $this->updateAlias($strOldIndex,$strNewIndex,$this->alias);
            $this->deleteIndex($strOldIndex);
            $this->setIndex($strNewIndex);
        }
    }

    public function getIndexName() {
        echo $this->getExistingIndex();
    }

    protected function getExistingIndex() {

        $stm = 'SELECT index_name FROM indices';

        $stm .= ($this->debug===true ? ' WHERE debug=1' : ' WHERE debug!=1');

        $records = $this->pdo->fetchOne($stm);

       return current($records);
    }

    protected function setIndex($strIndex) {

        $stm = "SELECT * FROM indices WHERE debug=" . ($this->debug===true ? "'1'" : "''");

        $records = $this->pdo->fetchAll($stm);

        if($records) {
            //run update
            $stm = "UPDATE indices SET index_name='$strIndex'";

            $stm .= $this->debug===true ? " WHERE debug='1'" : "WHERE debug=''";

        }else{
            //else insert
            $stm = "INSERT INTO indices SET index_name='$strIndex'";

            $stm .= $this->debug==true ? ", debug='1'" : "";
        }

        $this->pdo->exec($stm);
    }

    /*public function setIndexName() {
        $this->setIndex();
    }*/

    //index data
    //TODO: Push to the correct storage medium (mysql or elasticsearch)
    public function putDocuments($strIndex,$arrData) {

        //elasticsearch-specific index build
        foreach($arrData as $i=>$doc) {

            $params['body'][] = array(
                'index' => array(
                    '_index' => $strIndex,
                    '_type' => 'location',
                    '_id' => $i
                )
            );

            $params['body'][] = [
                "catalog"   => $doc["catalog"],
                "categories"   => $doc["categories"],
                "city"   => $doc["city"],
                "client"   => $doc["client"],
                "location"   => $doc["location"],
                "country"   => $doc["country"],
                "national"   => $doc["national"],
                "online"   => $doc["online"],
                "postal"   => $doc["postal"],
                "street"   => $doc["street"],
                "subdivision"   => $doc["subdivision"],
                "url"   => $doc["url"],
                "use_geospatial"   => (isset($doc['postal']) ? true : false)
            ];
        }

        if(count($params)) {
            $responses = $this->client->bulk($params);
            // erase the old bulk request
            $params = [];

            // unset the bulk response when you are done to save memory
            unset($responses);
        }
    }

    public function createIndex($strIndex) {
        $indexParams['index'] = $strIndex;
        $indexParams['body']['settings']['number_of_shards'] = 1;
        $indexParams['body']['settings']['number_of_replicas'] = 1;
        $this->client->indices()->create($indexParams);

        $this->putMapping($strIndex);
    }

    public function deleteIndex($strIndex) {
        $deleteParams['index'] = $strIndex;
        $this->client->indices()->delete($deleteParams);
    }

    public function addAlias() {
        $this->setAlias($this->indexbasename,$this->alias);
    }

    protected function setAlias($strIndex,$strAlias) {
        $params['index'] = $strIndex;
        $params['name'] = $strAlias;
        $params['body']['actions'][] = array(
            "add"   => array(
                "alias" => $strAlias,
                "index" => $strIndex
            )
        );

        $this->client->indices()->putAlias($params);
    }

    protected function updateAlias($strOldIndex, $strNewIndex,$strAlias) {

        $params['index'] = $strNewIndex;
        $params['name'] = $strAlias;
        $params['body']['actions'][] = array(
            "remove"    => array(
                "alias" => $strAlias,
                "index" => $strOldIndex
            ),
            "add"   => array(
                "alias" => $strAlias,
                "index" => $strNewIndex
            )
        );

        $this->client->indices()->putAlias($params);

    }

    public function writeJsonFile($strFileName,$arrData) {

        $strBaseUrl = 'search/';

        $arrFinal = array();
        //wipe keys out, they cause problems in json data.
        foreach($arrData as $k=>$data) {

            $arrFinal[] = $data;
        }

        $strContent = json_encode($arrFinal);
        //echo json_last_error_msg() . ' :: '.$strFileName . "\n";

        $objFile = new \SplFileObject($strBaseUrl.$strFileName, "w");
        $objFile->fwrite($strContent);

        $objFile = null;

    }

    public function geocode($arrData) {

        $adapter    = new \Geocoder\HttpAdapter\CurlHttpAdapter();

        //had to disable bulk because we lose track of anything past the basic address info for each index record. have
        //to geocode individually :/
        /*$provider   = new \GeocoderBulk\Provider\MapQuestProvider(
            $adapter,
            'rS2LknWFrheiVhmdNehlt8mfwKNo92gS'
        );*/

        /*$provider = new \Geocoder\Provider\MapQuestProvider(
            $adapter,
            'rS2LknWFrheiVhmdNehlt8mfwKNo92gS'
        );*/

        $provider = new \Geocoder\Provider\GoogleMapsProvider(
            $adapter,null,null,true,'AIzaSyAE9Ckkiwzj-0sLxx1lOcR9kbF-8m5xI68'
        );

        /*$chain = new \Geocoder\Provider\Chain([
            new \Geocoder\Provider\GoogleMaps($adapter,'en-US','United States',true,'AIzaSyAE9Ckkiwzj-0sLxx1lOcR9kbF-8m5xI68'),
            new \Geocoder\Provider\MapQuestProvider(
                $adapter,
                'rS2LknWFrheiVhmdNehlt8mfwKNo92gS'
            )
        ]);*/

        #$factory = new \Geocoder\Result\MultipleResultFactory();

        $geocoder = new \Geocoder\Geocoder();

        $geocoder->registerProvider($provider);
        #$geocoder->setResultFactory($factory);

        $arrLocations = $arrData;
        #$arrLocations = array();

        /*
        foreach($arrData as $i=>$row) {

            if (!isset($row['postal'])||strlen($row['street'])==0)
                continue;

            $data = array_map('trim', $row);

            $strHashKey = md5($data['street'].' '.$data['city'].', '.$data['subdivision'].' '.$data['postal']);

            $arrLocations[$strHashKey] = $data; //eliminated duplicates specifically for geocoding
        }*/

        //var_dump($arrLocations); exit;

        /*if(count($arrLocations)>100) {
    
            //bulk geocoding, max 100 at a time.
            $intOffset = count($arrLocations) / 100;
    
            #$intRemainder = (!is_int($intOffset) ? count($arrRows) % 100 : 0);
    
            $arrResults = array();
    
            for($i=1;$i<=$intOffset;$i++) {
    
                $arrPortion = array_slice($arrLocations,$i*100);
    
                $addresses = $geocoder->limit(100)->geocode($arrPortion);
    
                $arrResults = array_merge($addresses, $arrResults);
            }*/

        //geocode the remainder
        /*if($intRemainder>0) {

            $arrRemainder = array_slice($arrRows,$intOffset)

        }*/
        /*}else{
    
            //otherwise geocode the whole thing at once.
            $addresses = $geocoder->geocode($arrLocations);
        }*/

        $arrCoords = array();

        foreach($arrLocations as $i=>$data) {
             //skip those without geocoding data (online-only locations)

            if((bool)$data['retailer']==true) {
                //bypass geocoding for online-only locations.
                if ((strlen(trim($data['postal']))==0||strlen(trim($data['street']))==0)) {
                    $strHashKey = md5(trim($data['url']));
                    $arrCoords[$strHashKey] = array(0,0); //fallback so we still get the results in the index
                }else{
                    $strHashKey = md5(trim($data['street']) . ' ' . trim($data['city']) . ', ' . trim($data['subdivision']) . ' ' . trim($data['postal']));

                    try {
                        $strAddress = str_replace(' ','+',$data['street']) . ',+' . $data['city'] . ',+' . $data['subdivision'] . ',+' . $data['postal'];

                        $result = $geocoder->geocode($strAddress);

                        #$arrCoords[$strHashKey] = array($result->getLatitude(), $result->getLongitude());
                        //reversed since it is stored as an array
                        $arrCoords[$strHashKey] = array($result->getLongitude(), $result->getLatitude());
                    }catch(Exception $e) {
                        $_SESSION['GEOCODE']['ERRORS'][] = $data['customer'];
                        continue;
                    }
                }
            }else {
                $strHashKey = md5(trim($data['url']));
                $arrCoords[$strHashKey] = array(0,0); //fallback so we still get the results in the index
            }

            #echo $strHashKey . ': '.$data['street'] . ', ' . $data['city'] . ', ' . $data['subdivision'] . ', ' . $data['postal'].": ".$result->getLatitude().", ".$result->getLongitude()."\n";
        }

        $arrFinal = array();

        //recombine coords and all matching location records
        foreach($arrCoords as $k=>$data) {

            if (strlen($data['postal'])==0||strlen($data['street'])==0) {
                $strHashKey = md5(trim($data['url']));
            }else {
                $strHashKey = md5(trim($data['street']) . ' ' . trim($data['city']) . ', ' . trim($data['subdivision']) . ' ' . trim($data['postal']));
            }
            foreach($arrData as $location) {
                if (strlen($location['postal'])==0||strlen($location['street'])==0) {
                    $strHashKeyL = md5(trim($location['url']));
                }else{
                    $strHashKeyL = md5(trim($location['street']) . ' ' . trim($location['city']) . ', ' . trim($location['subdivision']) . ' ' . trim($location['postal']));
                }
                if($strHashKeyL==$k) {
                    $location['location'] = $data;
                    $arrFinal[] = $location;

                }
            }

            reset($arrData);    //start the array we're search against over
        }

        return $arrFinal;

    }

    public function getAll($strResource, $blnJson=true, $strWhere = '') {


        $strSql = 'SELECT * FROM tl_'.$strResource.$strWhere;

        #$records = R::getAll($strSql);
/*
        if ($records) {
            $this->app->response->setStatus(200);
            // send response header for JSON content type
            $this->app->response->header('Content-Type', 'application/json');

        }else{
            $records = array();
        }

        if($blnJson==true) {
            // return JSON-encoded response body with query results
            echo json_encode($records, JSON_NUMERIC_CHECK);
        }else{
            return $records;
        }*/
    }

    public function getAllBy($strResource, $strWhereKey, $varVal, $strFields = '*', $blnJson=true) {


        $strSql = 'SELECT '.$strFields.' FROM tl_'.$strResource.' WHERE '.$strWhereKey.' = :'.$strWhereKey;

        #$records = R::getAll($strSql, [ ':'.$strWhereKey => $varVal ]);
/*
        if ($records) {
            $this->app->response->setStatus(200);
            // send response header for JSON content type
            $this->app->response->header('Content-Type', 'application/json');

            if($blnJson==true) {
                // return JSON-encoded response body with query results
                echo json_encode($records, JSON_NUMERIC_CHECK);
            }else{
                return $records;
            }
        } else {
            // else throw exception
            return false;
        }*/
    }

    public function getOne($strResource, $strWhereKey, $varVal, $strFields = '*', $blnJson=true) {


        $strSql = 'SELECT '.$strFields.' FROM tl_'.$strResource.' WHERE '.$strWhereKey.' = :'.$strWhereKey;

        #$records = R::getRow($strSql, [ ':'.$strWhereKey =>$varVal ]);
/*
        if ($records) {
            $this->app->response->setStatus(200);
            // send response header for JSON content type
            $this->app->response->header('Content-Type', 'application/json');

            if($blnJson==true) {
                // return JSON-encoded response body with query results
                echo json_encode($records, JSON_NUMERIC_CHECK);
            }else{
                return $records;
            }
        } else {
            // else throw exception
            $this->app->halt(403, 'No record for '.$strResource.' found!');
        }*/
    }

    public function returnCORS() {

        $this->app->response->setStatus(200);
    }
}



$app = new \Slim\Slim(array(
    'debug' => true
));

$api = new ChartisApi();

$app->run();
