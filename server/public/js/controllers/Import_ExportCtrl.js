angular.module('Import_ExportCtrl', []).controller('Import_ExportController', ['$scope', 'gettextCatalog', '$state', '$ocLazyLoad', '$injector', '$rootScope', '$timeout', '$q', '$http', '$filter', function($scope, gettextCatalog, $state, $ocLazyLoad, $injector, $rootScope, $timeout, $q, $http, $filter){
    $rootScope.kernel.loading = 100;
    $scope.exportRange = {
        max: $rootScope.range.max,
        min: $rootScope.range.min,
        from: $rootScope.range.from.value,
        to: $rootScope.range.to.value
    };

    $scope.upload = function(){
        $ocLazyLoad.load('node_modules/ng-file-upload/dist/ng-file-upload.min.js').then(function() {
            var Upload = $injector.get('Upload');
            $scope.uploader = {};
            $rootScope.kernel.loading = 0;
            if ($scope.uploader.file) {
                $scope.uploader.file.upload = Upload.upload({
                    url: '/api/import',
                    data: $scope.uploader,
                    method:'PUT'
                });

                $scope.uploader.file.upload.then(function(response) {
                    $timeout(function () {
                        $scope.uploader.file.result = response.data;
                        $rootScope.kernel.loading = 100;
                        $state.transitionTo('home.dashboard.main');
                        $rootScope.kernel.alerts.push({
                            type:3,
                            msg: gettextCatalog.getString('The data have been imported'),
                            priority: 4
                        });
                    });
                }, function (response) {
                    if (response.status > 0){
                        $scope.errorMsg = response.status + ': ' + response.data;
                    }
                }, function (evt) {
                    // Math.min is to fix IE which reports 200% sometimes
                    //$scope.has been uploader.file.progress = Math.min(100, parseInt(100.0 * evt.loaded / evt.total));
                });
            }
        });
    }

    $scope.export = function (){
        $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function() {
            var FileSaver = $injector.get('FileSaver');
            $rootScope.kernel.loading = 0;
            if(($scope.exportRange.from && $scope.exportRange.to) && ($scope.exportRange.from <= $scope.exportRange.to)){
                var deferred = $q.defer();
                $scope.promise = deferred.promise;
                $http({
                    method: 'GET',
                    url:'/api/export/from/'+$scope.exportRange.from+'/to/'+$scope.exportRange.to,
                    headers: {'Content-Type': "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
                    responseType: "arraybuffer"
                }).then(function(response){
                    var d = new Blob([response.data], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});

                    var filename = 'Core_';
                    FileSaver.saveAs(d, filename + gettextCatalog.getString('Export') + '_' + $filter('ddMMyyyy')($scope.exportRange.from) + '-' + $filter('ddMMyyyy')($scope.exportRange.to) + '.xlsx');
                    $rootScope.kernel.loading = 100;
                    deferred.resolve(response.data);
                }).catch(function(response) {
                    console.error(response);
                });
            }
        });
    }
}]);
