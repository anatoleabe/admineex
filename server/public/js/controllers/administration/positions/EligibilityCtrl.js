angular.module('EligibilityCtrl', []).controller('EligibilityController', function ($scope, $window, $mdDialog, $q, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location, params) {
    //$rootScope.kernel.loading = 0;
    $scope.title = "...";
    $scope.params = params;

    $scope.query = {
        limit: 50,
        page: 1,
        order: "-corresponding"
    };

    $scope.helper = {
        title: gettextCatalog.getString("No correspondance found for this position"),
        subtitle: gettextCatalog.getString("Verify that the profile and skills required for the position have been completed ")
    };


    $scope.close = function () {
        $mdDialog.hide();
    }
    $scope.cancel = function () {
        $mdDialog.cancel();
    };


    $ocLazyLoad.load('js/services/StaffService.js').then(function () {
        var Staffs = $injector.get('Staff');

        $ocLazyLoad.load('js/services/PositionService.js').then(function () {
            var Position = $injector.get('Position');

            $scope.personnels = undefined;
            $scope.position = $scope.params.position;

            var deferred = $q.defer();

            Staffs.eligible({id: $scope.params.position._id}).then(function (response) {
                $scope.personnels = response.data;
                console.log($scope.personnels);
                deferred.resolve($scope.personnels);
            }).catch(function (response) {
                console.log(response);
            });
            return deferred.promise;

        });

        $scope.download = function () {
            $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                var FileSaver = $injector.get('FileSaver');
                $rootScope.kernel.loading = 0;
                var deferred = $q.defer();
                $scope.promise = deferred.promise;
                function jsonBufferToObject(data, headersGetter, status) {
                    var type = headersGetter("Content-Type");
                    if (!type.startsWith("application/json")) {
                        return data;
                    }
                    ;
                    var decoder = new TextDecoder("utf-8");
                    var domString = decoder.decode(data);
                    var json = JSON.parse(domString);
                    return json;
                }

                $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                    var Download = $injector.get('Download');
                    Download.start({
                        method: 'GET',
                        url: '/api/personnel/exportEligible/' + $scope.params.position._id,
                        headers: {'Content-Type': "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
                        transformResponse: jsonBufferToObject
                    }).then(function (response) {
                        var d = new Blob([response.data], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
                        var filename = 'Admineex';
                        FileSaver.saveAs(d, filename + gettextCatalog.getString('Adminex_Staff_Export') + '_' + '.xlsx');
                        $rootScope.kernel.loading = 100;
                        deferred.resolve(response.data);
                    }).catch(function (response) {
                        if (response.data && response.data.error === '9500') {
                            $rootScope.kernel.alerts.push({
                                type: 1,
                                msg: gettextCatalog.getString('The Export is too big. Please reduce the date range'),
                                priority: 1
                            });
                            $rootScope.kernel.loading = 100;
                        }
                    });
                });
            });
        }
    });
});
