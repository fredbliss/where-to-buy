(function() {

    'use strict';

    function AppConfig($stateProvider, $urlRouterProvider) {
        $urlRouterProvider.otherwise("/");

        $stateProvider.state('home', {
             url: '/',
             templateUrl: 'importform.html',
             controller: ImportCtrl,
             controllerAs: 'vm'
        });
    }

    function ImportCtrl(Upload,toastr) {
        var vm = this;
        vm.finished = false;
        vm.files = [];

        vm.upload = function (files) {
            if (files && files.length) {
                for (var i = 0; i < files.length; i++) {
                    var file = files[i];
                    Upload.upload({
                        url: './api/import/es',
                        fields: {},
                        method: "POST",
                        file: file
                    }).progress(function (evt) {
                        var progressPercentage = parseInt(100.0 * evt.loaded / evt.total);
                        vm.files[i-1].progress = Math.min(100, parseInt(100.0 * evt.loaded / evt.total));
                    }).success(function (data, status, headers, config) {
                        console.log(data);
                        if(data.status=='error') {
                            console.log(data.errors);
                              toastr.warning('These customer IDs have invalid address information and cannot be geocoded: ' + data.errors.join(),'Geocoding Errors',{allowHtml:true,closeButton:true,timeOut:60000,extendedTimeOut:60000,tapToDismiss:false,showMethod:'slideDown'});
                        }
                        toastr.success('Import Finished.','',{allowHtml:true,showMethod:'slideDown'});
                    });
                }


            }

        };

    }

    function ToastrConfig(toastrConfig) {

        angular.extend(toastrConfig, {

            closeButton: true,

            timeOut: 3000

        });

    }

    angular.module('pacon-import',[
        'ngAnimate',
        'ui.router',
        'restangular',
        'toastr',
        'ngFileUpload',
        'angular-svg-round-progress'
    ])
        .config(ToastrConfig)
        .config(AppConfig)
        .controller('ImportCtrl',['Upload','toastr',ImportCtrl]);
})();