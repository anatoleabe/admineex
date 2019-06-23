angular.module('PositionsCtrl', []).controller('PositionsController', function ($scope, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $mdDialog, $rootScope, $q, $http) {
    $ocLazyLoad.load('js/services/PositionService.js').then(function () {
        var Position = $injector.get('Position');
        $ocLazyLoad.load('js/services/StructureService.js').then(function () {
            var Structure = $injector.get('Structure');
            var helper = {
                title: gettextCatalog.getString("No position"),
                icon: "account_balance"
            };

            $scope.organizations = [], $scope.helper = [];
            $scope.search = false;
            $scope.filters = {};
            $scope.structures = [];
            $scope.showOnlyVacancies = false;
            $scope.query = {
                limit: 50,
                page: 1,
                order: "code"
            };

            $scope.details = function (params) {
                $state.go("home.administration.details", params);
            };

            $scope.edit = function (params) {
                $state.go("home.administration.edit", params);
            };

            $scope.new = function () {
                $state.go("home.administration.new");
            };

            $scope.toggleVacancies = function () {
                getPositions($scope.filters.structure ? $scope.filters.structure : "-1", $scope.showOnlyVacancies ? "0" : "-1");
            };

            function getPositions(idStructure, restric) {
                $scope.helper = [];
                $rootScope.kernel.loading = 0;
                var deferred = $q.defer();
                $scope.promise = deferred.promise;
                Position.list({id: idStructure, restric: restric}).then(function (response) {
                    var data = response.data;
                    if (data.length == 0 && $scope.helper.length == 0) {
                        $scope.helper = helper;
                    }
                    $rootScope.kernel.loading = 100;
                    $scope.positions = data;
                    deferred.resolve();
                }).catch(function (response) {
                    console.error(response);
                });
            }
            //// All structures (first -1)
            //// Vacancies and allowed positions (Second -1)
            getPositions(-1, -1);

            $scope.filterByStructure = function (idStructure) {
                getPositions(idStructure, $scope.showOnlyVacancies ? 0 : -1);
            };


            $scope.vacanciesOnly = function (item) {
                if ($scope.showOnlyVacancies == true) {
                    return item.vacancies && item.vacancies > 0;
                } else {
                    return true
                }
            };

            $scope.$watch('filters.structure', function (newval, oldval) {
                if (newval) {
                    newval = JSON.parse(newval).code;
                    getPositions(newval ? newval : "-1", $scope.showOnlyVacancies ? "0" : "-1");
                }
            });

            //Load structure list
            Structure.list().then(function (response) {
                var data = response.data;
                if (data.length == 0 && $scope.helper.length == 0) {
                    $scope.helper = helper;
                }
                $scope.structures = data;
            }).catch(function (response) {
                console.error(response);
            });


            $scope.openPdf = function () {
                $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                    var FileSaver = $injector.get('FileSaver');
                    $rootScope.kernel.loading = 0;
                    var deferred = $q.defer();
                    $scope.promise = deferred.promise;
                    var code = "-1";
                    
                    if ($scope.filters.structure){
                        var selectedTruct = JSON.parse($scope.filters.structure);
                        code = selectedTruct.code;
                    }
                    $http({
                        method: 'GET',
                        url: '/api/export/pdf/positions/'+code,
                        headers: {'Content-Type': "application/pdf"},
                        responseType: "arraybuffer"
                    }).then(function (response) {
                        var d = new Blob([response.data], {type: "application/pdf"});
                        FileSaver.saveAs(d, 'CV_xxx.pdf');
                        $rootScope.kernel.loading = 100;
                        deferred.resolve(response.data);
                    }).catch(function (response) {
                        console.error(response);
                    });
                });

            };


        });
    });
});
