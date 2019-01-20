(function() {
    'use strict';
    function AppConfig($routeProvider, $locationProvider, RestangularProvider, uiGmapGoogleMapApiProvider) {
        RestangularProvider.setBaseUrl('/assets/locations/api');
        $routeProvider.otherwise({redirectTo: '/'});
        $routeProvider.when('/:category?',{
            templateUrl: 'assets/locations/directives/main.html',
            controller: 'LocationSearchCtrl',
            controllerAs: 'vm',
            resolve: LocationSearchCtrl.resolve
        });

        $routeProvider.when('/',{});

        uiGmapGoogleMapApiProvider.configure({
            key: 'AIzaSyAymzIuGeru7WoATTQawdyuRRsoB5FyzDk',
            libraries: 'geometry',
            china: false,
            language: 'en'
        });

    }

    function AppRun($route, $rootScope, $location) {
        var original = $location.path;
        $location.path = function (path, reload) {
            if (reload === false) {
                var lastRoute = $route.current;
                var un = $rootScope.$on('$locationChangeSuccess', function () {
                    $route.current = lastRoute;
                    un();
                });
            }
            return original.apply($location, [path]);
        };
    }

    function LocationSearch(GeolocationService) {
        var LocationSearch = {
            restrict: 'E',
            templateUrl: 'assets/locations/directives/locationsearch.html',
            link: link,
            scope: true,
            bindToController: {
                category: '@?',
                gmkey: '@',
                showCategories: '=',
                groups: '=?'
            },
            compile: compile,
            controller: LocationSearchDirectiveCtrl,
            controllerAs: 'vm'
        };

        function link(scope, element, attrs, controller, transcludeFn) {

        }

        function compile(element, attrs) {
            if(!attrs.groups) {
                attrs.groups = false;
            }
            if(!attrs.showCategories) {
                attrs.showCategories = true;
            }
        }

        return LocationSearch;
    }

    LocationSearchCtrl.resolve = {
        coords: function($q, $window, GeolocationService) {
            var deferred = $q.defer();
            GeolocationService.getLocation().then(function(position){
                deferred.resolve({coords: [position.coords.longitude,position.coords.latitude]});
            }, function(error){
                deferred.resolve({
                    coords: false
                });
            });
            return deferred.promise;
        },
        category: function($q, $routeParams) {
            var deferred = $q.defer();

            if($routeParams.category) {
                deferred.resolve($routeParams.category);
            }else{
                deferred.resolve(false);
            }

            return deferred.promise;
        }
    };
    function LocationSearchDirectiveCtrl(toastr, uiGmapGoogleMapApi, GeolocationService, SearchService, $location, $analytics) {
        var vm = this;

        vm.onClickTab = function (tab) {
            $analytics.eventTrack('click', {
                category: 'Where To Buy', label: 'Tab ' + tab.title + ' clicked.'
            });
            vm.currentTab = tab.url;
        };

        vm.isActiveTab = function(tabUrl) {
            return tabUrl == vm.currentTab;
        };

        vm.clearFilters = function() {
            vm.currcategory = null;
            vm.enableCats = true;
            $location.path('/', false);

            vm.findLocations();
        };

        vm.toggleMap = function(marker,id) {
            vm.map.center = {latitude: marker.location[1],longitude: marker.location[0]};
            vm.currmarker = {latitude: marker.location[1],longitude: marker.location[0], id: id};
            vm.mapShown = true;
            vm.refreshMap = true;
        };

        vm.hideMap = function() {
            vm.mapShown = false;
        };

        vm.findLocations = function() {

            if(vm.groupcategory) {
                vm.category = vm.groupcategory.value;
            }else{
                vm.category = angular.isDefined(vm.currcategory) && vm.currcategory!=null ? vm.currcategory : vm.originalcategory;
            }

            if(vm.category == '') {  //reset value to the correct pre-set category
                vm.category = vm.originalcategory
                vm.categoryarray = angular.isDefined(vm.currcategory) ? vm.currcategory.split(",") : vm.categories;
                console.log('find locations: '+vm.category);
            }else{

            }
            console.log(vm.category)
            toastr.info('Searching locations...','',{allowHtml:true,showMethod:'slideDown'});
            if(vm.postal) {    //update latlng

                GeolocationService.getLocationByAddress(vm.postal,vm.gmkey).then(function (response) {

                    vm.latlng = response.coords;

                    SearchService.search(vm.latlng, vm.currcategory).then(function (results) {

                        vm.locations = results;

                        if(results.length==0) {
                            vm.noresultsmessage = 'No Results Found.';
                            vm.locationsfound = false;
                        }else{
                            vm.locationsfound = true;
                        }
                    });
                });
            }else{

                SearchService.search(vm.latlng, vm.currcategory).then(function (results) {

                    vm.locations = results;

                    if(results.length==0) {
                        vm.noresultsmessage = 'No Results Found.';
                        vm.locationsfound = false;
                    }else{
                        vm.locationsfound = true;
                    }
                });
            }

        };

        vm.findLocationsGrouped = function() {

            vm.category = angular.isDefined(vm.groupcategory) && vm.groupcategory!=null ? vm.groupcategory.value : vm.originalcategory;
            vm.currcategory = vm.category
            /*if(vm.category == '') {  //reset value to the correct pre-set category
                vm.category = vm.originalcategory
                vm.categoryarray = angular.isDefined(vm.category) ? vm.currcategory.split(",") : vm.categories;
            }else{

            }*/

            toastr.info('Searching locations...','',{allowHtml:true,showMethod:'slideDown'});
            if(vm.postal) {    //update latlng

                GeolocationService.getLocationByAddress(vm.postal,vm.gmkey).then(function (response) {

                    vm.latlng = response.coords;

                    SearchService.search(vm.latlng, vm.category).then(function (results) {

                        vm.locations = results;

                        if(results.length==0) {
                            vm.noresultsmessage = 'No Results Found.';
                            vm.locationsfound = false;
                        }else{
                            vm.locationsfound = true;
                        }
                    });
                });
            }else{

                SearchService.search(vm.latlng, vm.category).then(function (results) {

                    vm.locations = results;

                    if(results.length==0) {
                        vm.noresultsmessage = 'No Results Found.';
                        vm.locationsfound = false;
                    }else{
                        vm.locationsfound = true;
                    }
                });
            }

        };

        vm.originalcategory = vm.category;
        vm.groupcategory = '';
        vm.groups = !angular.isDefined(vm.groups) ? false : vm.groups;
        vm.categories = [
            "Activity Kits","Art and Drawing Papers","Art Integration Kits","Art and Kraft Rolls",
            "ArtKraft Duo-Finish Rolls","Beads and Accessories","Bordette Borders",
            "Card Stock","Chalk and Accessories","Chart Tablets and Stands","Chenille Stems",
            "Classroom Keepers","Composition Books","Corobuff Corrugated Paper","Creativity Street Craft Essentials",
            "Dry Erase Products","Educational Aids","Ella Bella Photography Backdrops","Fadeless Paper",
            "Flame Retardant Rolls","Foam Board","Glitter and Glitter Glue","Gorilla Blocks","Handwriting Papers",
            "Kraft Bags","Letters and Accessories","Makerspace Kits","Mind Sparks Learning Games","Modeling Materials and Accessories",
            "Multi-Purpose Papers","Office Papers","Pacon Construction Paper","Paint and Art Accessories",
            "Paper Roll Dispensers and Racks","Pocket Charts","Presentation Boards and Accessories",
            "Privacy Boards","Puzzles","Railroad and Poster Board","Rainbow Colored Kraft Duo-Finish Rolls",
            "Riverside 3D Construction Paper","Ruled Papers","Sentence Strips/Flash Cards/Index Cards",
            "Specialty Surfaces","SunWorks Construction Paper","Tagboard","Tissue","Tru-Ray Construction Paper",
            "Wiggle Eyes","WonderFoam Craft Essentials","WonderFoam Early Learning","Wood Crafts",
            "Yarn and Accessories"];

        vm.groupedcategories = [
            {
                value: "Art Integration Kits",
                label: "Art Integration Kits",
                group: ""
            },
            {
                value: "Makerspace Kits",
                label: "Makerspace Kits",
                group: ""
            },
            {
                value: "Art and Drawing Papers",
                label: "Art and Drawing Papers",
                group: "Crafted for STEAM"
            },
            {
                value: "Beads and Accessories",
                label: "Beads and Accessories",
                group: "Crafted for STEAM"
            },
            {
                value: "Card Stock",
                label: "Card Stock",
                group: "Crafted for STEAM"
            },
            {
                value: "Chenille Stems",
                label: "Chenille Stems",
                group: "Crafted for STEAM"
            },
            {
                value: "Classroom Keepers",
                label: "Classroom Keepers",
                group: "Crafted for STEAM"
            },
            {
                value: "Creativity Street Craft Essentials",
                label: "Creativity Street Craft Essentials",
                group: "Crafted for STEAM"
            },
            {
                value: "Foam Board",
                label: "Foam Board",
                group: "Crafted for STEAM"
            },
            {
                value: "Glitter and Glitter Glue",
                label: "Glitter and Glitter Glue",
                group: "Crafted for STEAM"
            },
            {
                value: "Modeling Materials and Accessories",
                label: "Modeling Materials and Accessories",
                group: "Crafted for STEAM"
            },
            {
                value: "Paint and Art Accessories",
                label: "Paint and Art Accessories",
                group: "Crafted for STEAM"
            },
            {
                value: "Posterboard",
                label: "Posterboard",
                group: "Crafted for STEAM"
            },
            {
                value: "Ruled Papers",
                label: "Ruled Papers",
                group: "Crafted for STEAM"
            },
            {
                value: "Specialty Surfaces",
                label: "Specialty Surfaces",
                group: "Crafted for STEAM"
            },
            {
                value: "Tagboard",
                label: "Tagboard",
                group: "Crafted for STEAM"
            },
            {
                value: "Tissue",
                label: "Tissue",
                group: "Crafted for STEAM"
            },
            {
                value: "Wiggle Eyes",
                label: "Wiggle Eyes",
                group: "Crafted for STEAM"
            },
            {
                value: "Wonderfoam Craft Essentials",
                label: "Wonderfoam Craft Essentials",
                group: "Crafted for STEAM"
            },
            {
                value: "Wood Crafts",
                label: "Wood Crafts",
                group: "Crafted for STEAM"
            },
            {
                value: "Yarn and Accessories",
                label: "Yarn and Accessories",
                group: "Crafted for STEAM"
            }
        ]

        vm.locations = [];
        vm.locationsfound = false;
        vm.currcategory = '';

        vm.categoryarray = vm.categories;
        
        //NOTE: this overrides initial selected category but does not limit categories.

        //either parameter-based category or by directive pre-set (the else condition)
        if(angular.isDefined($location.search().category)) {
            GeolocationService.getLocation().then(function(position) {
                vm.latlng = [position.coords.longitude,position.coords.latitude];
                vm.currcategory = $location.search().category;
                vm.originalcategory = vm.currcategory;
                vm.locationsfound = true;
                if(vm.latlng!==false) {
                    SearchService.search(vm.latlng,vm.currcategory).then(function (results) {
                        vm.locations = results;
                        if(results.length==0) {
                            vm.noresultsmessage = 'No Results Found.';
                            vm.locationsfound = false;
                            vm.enableCats = true;
                        }else{
                            vm.locationsfound = true;
                            vm.map.center = {latitude: vm.locations[0].data.location[1],longitude: vm.locations[0].data.location[0]};
                            vm.currmarker = {latitude: vm.locations[0].data.location[1],longitude: vm.locations[0].data.location[0], id: 0};
                        }

                    });
                }
            })
        }else{
            vm.categoryarray = angular.isDefined(vm.category) ? vm.category.split(",") : vm.categories;
        }

        vm.enableCats = angular.isDefined(vm.showCategories) || !angular.isDefined(vm.category) ? true : false;

        if(!angular.isDefined(vm.currcategory)) {
            vm.currcategory = vm.category;
            vm.originalcategory = vm.category;
        }else if(angular.isDefined(vm.categoryarray)) {
            vm.currcategory = vm.category; // For search we pass the string separate by commas to the search function.
            vm.originalcategory = vm.category;
        }

        vm.category2 = vm.category;
        vm.category3 = vm.category;
        vm.category4 = vm.category;

        vm.map = {};
        vm.marker = {};
        vm.postal = '';
        vm.latlng = false;
        vm.categoryselect = {};
        vm.productselect = {};
        vm.map.options = {};
        vm.distance = 500;
        vm.distunits = 'miles';
        vm.noresultsmessage = 'Please provide a postal code or full address to find locations closest to you, or try another tab.';
        vm.modalShown = false;

        vm.tabs = [{
            title: 'Local Retailers',
            url: 'listing.local.html'
        }, {
            title: 'General Retailers',
            url: 'listing.general.html'
        }, {
            title: 'E-commerce',
            url: 'listing.online.html'
        }, {
            title: 'Catalog / Distributor',
            url: 'listing.catalogdistro.html'
        }];

        vm.currentTab = 'listing.local.html';

        GeolocationService.getLocation().then(function(position){
            vm.latlng = [position.coords.longitude,position.coords.latitude];

            uiGmapGoogleMapApi.then(function(maps) {
                //perform initial search on first load
                vm.map.options.styles = [
                    {
                        "featureType": "administrative",
                        "elementType": "labels.text",
                        "stylers": [
                            {
                                "saturation": "-2"
                            }
                        ]
                    },
                    {
                        "featureType": "administrative",
                        "elementType": "labels.text.stroke",
                        "stylers": [
                            {
                                "color": "#fead16"
                            },
                            {
                                "lightness": "87"
                            },
                            {
                                "saturation": "40"
                            }
                        ]
                    },
                    {
                        "featureType": "landscape",
                        "elementType": "all",
                        "stylers": [
                            {
                                "hue": "#6600ff"
                            },
                            {
                                "saturation": -11
                            }
                        ]
                    },
                    {
                        "featureType": "landscape.man_made",
                        "elementType": "labels.text.fill",
                        "stylers": [
                            {
                                "saturation": "-68"
                            }
                        ]
                    },
                    {
                        "featureType": "poi",
                        "elementType": "all",
                        "stylers": [
                            {
                                "saturation": -78
                            },
                            {
                                "hue": "#6600ff"
                            },
                            {
                                "lightness": -47
                            },
                            {
                                "visibility": "off"
                            }
                        ]
                    },
                    {
                        "featureType": "road",
                        "elementType": "all",
                        "stylers": [
                            {
                                "hue": "#5e00ff"
                            },
                            {
                                "saturation": -79
                            }
                        ]
                    },
                    {
                        "featureType": "road.highway",
                        "elementType": "geometry.fill",
                        "stylers": [
                            {
                                "color": "#0d357c"
                            }
                        ]
                    },
                    {
                        "featureType": "road.highway",
                        "elementType": "geometry.stroke",
                        "stylers": [
                            {
                                "color": "#0d357c"
                            }
                        ]
                    },
                    {
                        "featureType": "road.local",
                        "elementType": "all",
                        "stylers": [
                            {
                                "lightness": 30
                            },
                            {
                                "weight": 1.3
                            }
                        ]
                    },
                    {
                        "featureType": "transit",
                        "elementType": "all",
                        "stylers": [
                            {
                                "visibility": "simplified"
                            },
                            {
                                "hue": "#5e00ff"
                            },
                            {
                                "saturation": -16
                            }
                        ]
                    },
                    {
                        "featureType": "transit.line",
                        "elementType": "all",
                        "stylers": [
                            {
                                "saturation": -72
                            }
                        ]
                    },
                    {
                        "featureType": "water",
                        "elementType": "all",
                        "stylers": [
                            {
                                "saturation": -65
                            },
                            {
                                "hue": "#1900ff"
                            },
                            {
                                "lightness": 8
                            }
                        ]
                    }
                ];
                if(vm.latlng!==false) {
                    SearchService.search(vm.latlng,vm.currcategory).then(function (results) {
                        vm.locations = results;
                        if(results.length==0) {
                            vm.noresultsmessage = 'No Results Found.';
                            vm.locationsfound = false;
                            vm.enableCats = true;
                        }else{
                            vm.locationsfound = true;
                            vm.map.center = {latitude: vm.locations[0].data.location[1],longitude: vm.locations[0].data.location[0]};
                            vm.currmarker = {latitude: vm.locations[0].data.location[1],longitude: vm.locations[0].data.location[0], id: 0};
                        }

                    });
                }
            });
        }, function(error){
            vm.latlng = false;
        });

        SearchService.getJsonFile('catalog.json').then(function (results) {
            vm.catalogdistrolocations = results;
        });

        SearchService.getJsonFile('general.json').then(function (results) {
            vm.generallocations = results;
        });

        SearchService.getJsonFile('online.json').then(function (results) {
            vm.onlinelocations = results;
        });


        /*vm.findByCategory = function() {
            toastr.info('Searching locations...','',{allowHtml:true,showMethod:'slideDown'});
            SearchService.search(vm.latlng, vm.currcategory).then(function (results) {
                vm.locations = results;
            });
        };*/
    }

    function LocationSearchCtrl(coords, category, toastr, uiGmapGoogleMapApi, GeolocationService,SearchService, $location) {
        var vm = this;
        vm.categories = [{"value": "Art & Kraft Rolls", "label": "Art & Kraft Rolls"},
            {"value": "ArtKraft Duo-Finish Rolls", "label": "ArtKraft Duo-Finish Rolls"},
            {"value": "Basic Crafts", "label": "Basic Crafts"},
            {"value": "Bordette Borders", "label": "Bordette Borders"},
            {"value": "Card Stock", "label": "Card Stock"},
            {"value": "Chart Stands", "label": "Chart Stands"},
            {"value": "Chart Tablets & Pads", "label": "Chart Tablets & Pads"},
            {"value": "Classroom Organization", "label": "Classroom Organization"},
            {"value": "Composition Books", "label": "Composition Books"},
            {"value": "Corobuff Corrugated Paper", "label": "Corobuff Corrugated Paper"},
            {"value": "Creative Cut-Ups", "label": "Creative Cut-Ups"},
            {"value": "Drawing Papers", "label": "Drawing Papers"},
            {"value": "Dry Erase Products", "label": "Dry Erase Products"},
            {"value": "Educational Aids", "label": "Educational Aids"},
            {"value": "Ella Bella Photography Backdrops", "label": "Ella Bella Photography Backdrops"},
            {"value": "Fadeless Paper", "label": "Fadeless Paper"},
            {"value": "Filler Paper", "label": "Filler Paper"},
            {"value": "Flame Retardant Rolls", "label": "Flame Retardant Rolls"},
            {"value": "Foam Board", "label": "Foam Board"},
            {"value": "Juvenile Art Papers", "label": "Juvenile Art Papers"},
            {"value": "Kraft Bags", "label": "Kraft Bags"},
            {"value": "Learning Walls", "label": "Learning Walls"},
            {"value": "Letters", "label": "Letters"},
            {"value": "Lightweight Construction Paper", "label": "Lightweight Construction Paper"},
            {"value": "Mind Sparks Learning Games", "label": "Mind Sparks Learning Games"},
            {"value": "Non-Bleeding Art Tissue", "label": "Non-Bleeding Art Tissue"},
            {"value": "Office Papers", "label": "Office Papers"},
            {"value": "Pacon Construction Paper", "label": "Pacon Construction Paper"},
            {"value": "Paper Roll Dispensers & Racks", "label": "Paper Roll Dispensers & Racks"},
            {"value": "Plast'r Craft", "label": "Plast'r Craft"},
            {"value": "Pocket Charts", "label": "Pocket Charts"},
            {"value": "Presentation Boards & Accessories", "label": "Presentation Boards & Accessories"},
            {"value": "Protecto Film", "label": "Protecto Film"},
            {"value": "Railroad/Poster Board", "label": "Railroad/Poster Board"},
            {"value": "Rainbow Colored Kraft Duo-Finish Rolls", "label": "Rainbow Colored Kraft Duo-Finish Rolls"},
            {"value": "Riverside Groundwood Construction Paper", "label": "Riverside Groundwood Construction Paper"},
            {"value": "Ruled Papers", "label": "Ruled Papers"},
            {"value": "Sentence Strips/Flashcards/Index Cards", "label": "Sentence Strips/Flashcards/Index Cards"},
            {"value": "Specialty Construction Paper", "label": "Specialty Construction Paper"},
            {"value": "Spectra Deluxe Bleeding Art Tissue", "label": "Spectra Deluxe Bleeding Art Tissue"},
            {"value": "Spectra Glitter", "label": "Spectra Glitter"},
            {"value": "Student Art Papers", "label": "Student Art Papers"},
            {"value": "SunWorks Groundwood Construction Paper", "label": "SunWorks Groundwood Construction Paper"},
            {"value": "Tagboard", "label": "Tagboard"},
            {"value": "Tru-Ray Sulphite Construction Paper", "label": "Tru-Ray Sulphite Construction Paper"},
            {"value": "Yarn & Accessories", "label": "Yarn & Accessories"}];
        vm.enableCats = (category===false ? true : false);
        vm.locations = [];
        vm.locationsfound = false;
        vm.category = (category===false ? '' : category.replace('-',''));
        vm.category2 = '';
        vm.category3 = '';
        vm.category4 = '';
        vm.map = {};
        vm.marker = {};
        vm.postal = '';
        vm.categoryselect = {};
        vm.productselect = {};
        vm.latlng = coords.coords;
        vm.map.options = {};
        vm.distance = 500;
        vm.distunits = 'miles';
        vm.noresultsmessage = 'Please provide a postal code or full address to find locations closest to you, or try another tab.';
        vm.modalShown = false;
        vm.tabs = [{
            title: 'Local Retailers',
            url: 'listing.local.html'
        }, {
            title: 'General Retailers',
            url: 'listing.general.html'
        }, {
            title: 'Online Retailers',
            url: 'listing.online.html'
        }, {
            title: 'Catalog / Distributor',
            url: 'listing.catalogdistro.html'
        }];
        vm.currentTab = 'listing.local.html';

        vm.onClickTab = function (tab) {
            vm.currentTab = tab.url;
        };
        vm.isActiveTab = function(tabUrl) {
            return tabUrl == vm.currentTab;
        };
        vm.clearFilters = function() {
            vm.category = '';
            vm.enableCats = true;
            $location.path('/', false);
            vm.findLocations();
        };

        uiGmapGoogleMapApi.then(function(maps) {
            //perform initial search on first load
            vm.map.options.styles = [
                {
                    "featureType": "administrative",
                    "elementType": "labels.text",
                    "stylers": [
                        {
                            "saturation": "-2"
                        }
                    ]
                },
                {
                    "featureType": "administrative",
                    "elementType": "labels.text.stroke",
                    "stylers": [
                        {
                            "color": "#fead16"
                        },
                        {
                            "lightness": "87"
                        },
                        {
                            "saturation": "40"
                        }
                    ]
                },
                {
                    "featureType": "landscape",
                    "elementType": "all",
                    "stylers": [
                        {
                            "hue": "#6600ff"
                        },
                        {
                            "saturation": -11
                        }
                    ]
                },
                {
                    "featureType": "landscape.man_made",
                    "elementType": "labels.text.fill",
                    "stylers": [
                        {
                            "saturation": "-68"
                        }
                    ]
                },
                {
                    "featureType": "poi",
                    "elementType": "all",
                    "stylers": [
                        {
                            "saturation": -78
                        },
                        {
                            "hue": "#6600ff"
                        },
                        {
                            "lightness": -47
                        },
                        {
                            "visibility": "off"
                        }
                    ]
                },
                {
                    "featureType": "road",
                    "elementType": "all",
                    "stylers": [
                        {
                            "hue": "#5e00ff"
                        },
                        {
                            "saturation": -79
                        }
                    ]
                },
                {
                    "featureType": "road.highway",
                    "elementType": "geometry.fill",
                    "stylers": [
                        {
                            "color": "#0d357c"
                        }
                    ]
                },
                {
                    "featureType": "road.highway",
                    "elementType": "geometry.stroke",
                    "stylers": [
                        {
                            "color": "#0d357c"
                        }
                    ]
                },
                {
                    "featureType": "road.local",
                    "elementType": "all",
                    "stylers": [
                        {
                            "lightness": 30
                        },
                        {
                            "weight": 1.3
                        }
                    ]
                },
                {
                    "featureType": "transit",
                    "elementType": "all",
                    "stylers": [
                        {
                            "visibility": "simplified"
                        },
                        {
                            "hue": "#5e00ff"
                        },
                        {
                            "saturation": -16
                        }
                    ]
                },
                {
                    "featureType": "transit.line",
                    "elementType": "all",
                    "stylers": [
                        {
                            "saturation": -72
                        }
                    ]
                },
                {
                    "featureType": "water",
                    "elementType": "all",
                    "stylers": [
                        {
                            "saturation": -65
                        },
                        {
                            "hue": "#1900ff"
                        },
                        {
                            "lightness": 8
                        }
                    ]
                }
            ];

            if(coords.coords!==false) {
                SearchService.search(coords.coords,vm.category).then(function (results) {
                    vm.locations = results;

                    if(results.length==0) {
                        vm.noresultsmessage = 'No Results Found.';
                        vm.locationsfound = false;
                    }else{
                        vm.locationsfound = true;
                    }

                    vm.map.center = {latitude: vm.locations[0].data.location[1],longitude: vm.locations[0].data.location[0]};
                    vm.currmarker = {latitude: vm.locations[0].data.location[1],longitude: vm.locations[0].data.location[0], id: 0};
                });
            }
        });

        vm.toggleMap = function(marker,id) {
            vm.map.center = {latitude: marker.location[1],longitude: marker.location[0]};
            vm.currmarker = {latitude: marker.location[1],longitude: marker.location[0], id: id};
            vm.mapShown = true;
            vm.refreshMap = true;
        };
        vm.hideMap = function() {
            vm.mapShown = false;
        };
        vm.findLocations = function() {
            toastr.info('Searching locations...','',{allowHtml:true,showMethod:'slideDown'});
            if(vm.postal) {    //update latlng
                GeolocationService.getLocationByAddress(vm.postal,vm.gmkey).then(function (response) {
                    vm.latlng = response;
                    SearchService.search(vm.latlng, vm.category).then(function (results) {

                        vm.locations = results;

                        if(results.length==0) {
                            vm.noresultsmessage = 'No Results Found.';
                            vm.locationsfound = false;
                        }else{
                            vm.locationsfound = true;
                        }
                    });
                });
            }else{
                SearchService.search(vm.latlng, vm.category).then(function (results) {

                    vm.locations = results;

                    if(results.length==0) {
                        vm.noresultsmessage = 'No Results Found.';
                        vm.locationsfound = false;
                    }else{
                        vm.locationsfound = true;
                    }
                });
            }
        };
        SearchService.getJsonFile('catalog.json').then(function (results) {
            vm.catalogdistrolocations = results;
        });
        SearchService.getJsonFile('general.json').then(function (results) {
            vm.generallocations = results;
        });
        SearchService.getJsonFile('online.json').then(function (results) {
            vm.onlinelocations = results;
        });
        /*vm.findByCategory = function() {
            toastr.info('Searching locations...','',{allowHtml:true,showMethod:'slideDown'});
            SearchService.search(vm.latlng, vm.category).then(function (results) {
                vm.locations = results;
            });
        };*/
    }

    function ESClientService(esFactory) {
        return esFactory({
            host: 'https://0664c0c35f4255df000.qb0x.com:443/'
        });
    }

    function SearchService($q, $http, toastr, ESClientService) {
        var SearchService = {};
        var offset = 0;
        SearchService.search = function(latlng, category) {
            var deferred;
            deferred = $q.defer();
            var filter = '';
            var dsl = '';

            var categories = angular.isDefined(category) && category!=null ? category.split(",") : '';
            console.log('hello')
            console.log(categories);

            if(category) {
                var query = {
                    filtered: {
                        filter: {
                            and: [
                                {
                                    geo_distance: {
                                        distance: "500mi",
                                        location: latlng
                                    }
                                },
                                {
                                    "terms": {
                                        "categories": categories
                                    }
                                }
                            ]
                        }
                    }
                };
                dsl = {
                    index : 'paconlocations',
                    type : 'location',
                    body : {
                        size : 30,
                        from : (offset || 0) * 10,
                        query : query,
                        sort: [
                            {
                                _geo_distance: {
                                    location: latlng,
                                    order:         "asc",
                                    unit:          "miles",
                                    distance_type: "arc"
                                }
                            }
                        ]
                    }
                };
            }else {
                var query = {
                    filtered: {
                        filter: {
                            or: [{
                                geo_distance : {
                                    distance : "500mi",
                                    location : latlng
                                }
                            }]
                        }
                    }
                };

                dsl = {
                    index : 'paconlocations',
                    type : 'location',
                    body : {
                        size : 30,
                        from : (offset || 0) * 10,
                        query : query,
                        sort: [
                            {
                                _geo_distance: {
                                    location: latlng,
                                    order:         "asc",
                                    unit:          "miles",
                                    distance_type: "arc"
                                }
                            }
                        ]
                    }
                };
            }
            ESClientService.search(dsl).then(function(result) {

                var ii = 0, hits_in, hits_out = [];
                hits_in = (result.hits || {}).hits || [];
                hits_out = [];
                var hitswithdist = [];
                for(; ii < hits_in.length; ii++) {
                    var dist = (hits_in[ii].sort ? hits_in[ii].sort[0] : 0);
                    hitswithdist = {data: hits_in[ii]._source,dist: dist};
                    hits_out.push(hitswithdist);
                }
                deferred.resolve(hits_out);
            }, deferred.reject);
            return deferred.promise;
        };
        SearchService.getJsonFile = function(file) {
            var deferred;
            deferred = $q.defer();
            $http({
                method: "GET",
                url:'/assets/locations/api/search/'+file
            })
                .success(function(data, status, headers, config) {
                    // this callback will be called asynchronously
                    // when the response is available
                    deferred.resolve(data);
                })
                .error(function(data, status, headers, config) {
                    // called asynchronously if an error occurs
                    // or server returns response with an error status.
                    return status;
                });
            return deferred.promise;
        };
        return SearchService;
    }
    function GeolocationService($q, $http, $window, $timeout){
        var GeolocationService = {};
        GeolocationService.getLocation = function(timeoutVal){
            var deferred = $q.defer(),
                n = $window.navigator,
                timeoutVal = timeoutVal || 10000,
                options = { timeout: timeoutVal };
            // Custom error objects
            var notSupportedError = {
                    code: 4,
                    NOT_SUPPORTED: 4,
                    message: 'Your device does not support Geolocation.'
                },
                requestIgnoredError = {
                    code: 5,
                    REQUEST_IGNORED: 5,
                    message: 'You need to grant us the permission to use your current location.'
                };
            // Here we reject the promise anyways after the specified timeout
            $timeout(function(){
                deferred.reject(requestIgnoredError);
            }, options.timeout);
            // Check if geolocation is supported
            if(n.geolocation){
                n.geolocation.getCurrentPosition(positionSuccess, positionError, options);
            } else {
                deferred.reject(notSupportedError);
            }
            function positionSuccess(position){
                // resolve the promise with the position object
                deferred.resolve(position);
            }
            function positionError(error){
                // reject the promise with the error object provided by the Geolocation API
                deferred.reject(error);
            }
            return deferred.promise;
        };
        GeolocationService.getLocationByAddress = function(address, key) {
            var deferred = $q.defer();
            var apikey = key; //'AIzaSyDlNvkqktkXo5f_2_8lr3h5J4S7kxRxz0M';
            var url = 'https://maps.googleapis.com/maps/api/geocode/json?address='+address+'&key='+apikey;
            var coords = {};
            $http.get(url).success(function(response) {
                angular.forEach(response.results, function(result) {
                    coords = {coords: [result.geometry.location.lng,result.geometry.location.lat]};
                });
                deferred.resolve(coords);
            }).error(deferred.reject);
            return deferred.promise;
        };
        GeolocationService.getGeoIP = function(ip) {
            var deferred;
            deferred = $q.defer();
            var response = $http.get('assets/locations/api/ip').success(function(data) {
                deferred.resolve(data);
            });
            return deferred.promise;
        };
        return GeolocationService;
    }
    function ToastrConfig(toastrConfig) {
        angular.extend(toastrConfig, {
            closeButton: true,
            timeOut: 1500
        });
    }
    function tabs() {
        return {
            restrict: "E",
            transclude: true,
            scope: {},
            controller: function($scope, $element) {
                var panes = $scope.panes = [];
                $scope.select = function(pane) {
                    angular.forEach(panes, function(pane) {
                        pane.selected = false;
                    });
                    if (pane.load !== undefined) {
                        pane.load();
                    }
                    pane.selected = true;
                };
                this.addPane = function(pane) {
                    if (panes.length === 0) $scope.select(pane);
                    panes.push(pane);
                };
            },
            template:
                '<div class="tabbable">' +
                '<ul class="nav nav-tabs">' +
                '<li ng-repeat="pane in panes" ng-class="{active:pane.selected}">'+
                '<a href="" ng-click="select(pane)">{{pane.tabTitle}}</a>' +
                '</li>' +
                '</ul>' +
                '<div class="tab-content" ng-transclude></div>' +
                '</div>',
            replace: true
        };
    }
    function modalDialog() {
        return {
            restrict: 'E',
            scope: {
                show: '=',
                marker: '=',
                id: '='
            },
            //replace: true, // Replace with the template below
            //transclude: true, // we want to insert custom content inside the directive
            link: function(scope, element, attrs) {
                scope.dialogStyle = {};
                if (attrs.width)
                    scope.dialogStyle.width = attrs.width;
                if (attrs.height)
                    scope.dialogStyle.height = attrs.height;
                scope.hideModal = function() {
                    scope.show = false;
                };
            },
            templateUrl: 'assets/locations/directives/modal.html'
        };
    }
    function property(){
        function parseString(input){
            return input.split(".");
        }
        function getValue(element, propertyArray){
            var value = element;
            _.forEach(propertyArray, function(property){
                value = value[property];
            });
            return value;
        }
        return function (array, propertyString, target){
            var properties = parseString(propertyString);
            return _.filter(array, function(item){
                return getValue(item, properties) == target;
            });
        }
    }
    function filterWithOr($filter) {
        return function(data, text){

            var textArr = angular.isDefined(text) ? text.split(',') : '';

            if(textArr.length>0) {
                angular.forEach(textArr, function(test){
                    if(test){
                        data = $filter('filter')(data, test);
                    }
                });
            }

            return data;
        }
    }

    function intersect(){
        return function(arr1, arr2){
            return arr1.filter(function(n) {
                return arr2.indexOf(n) != -1
            });
        };
    }

    angular.module('chartis',[
        'restangular',
        'ngAnimate',
        'ngRoute',
        'uiGmapgoogle-maps',
        'toastr',
        'elasticsearch',
        'angulartics',
        'angulartics.google.analytics'
    ])
        .config(AppConfig)
        .config(ToastrConfig)
        .filter('property',property)
        .filter('filterWithOr',filterWithOr)
        .filter('intersect',intersect)
        .directive('locationsearch',['GeolocationService',LocationSearch])
        .service('ESClientService',['esFactory',ESClientService])
        .service('SearchService',['$q', '$http', 'toastr', 'ESClientService', 'esFactory',SearchService])
        .service('GeolocationService', ['$q', '$http', '$window', '$timeout', GeolocationService])
        .controller('LocationSearchCtrl',['coords', 'category', 'toastr', 'uiGmapGoogleMapApi', 'GeolocationService','SearchService','$location',LocationSearchCtrl])
        .controller('LocationSearchDirectiveCtrl',['toastr', 'uiGmapGoogleMapApi', 'GeolocationService','SearchService','$location','$analytics',LocationSearchDirectiveCtrl])
        .run(AppRun)
})(); 
