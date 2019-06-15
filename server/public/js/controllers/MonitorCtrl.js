angular.module('MonitorCtrl', [[
        'node_modules/angular-material-data-table/dist/md-data-table.min.css'
    ]]).controller('MonitorController', function ($scope, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $mdDialog, $rootScope, $location) {
    $rootScope.kernel.loading = 100;

    var helper = {
        title: gettextCatalog.getString("No project"),
        icon: "class"
    };
    $scope.query = {
        limit: 50,
        page: 1,
        order: "name"
    };
    $scope.search = false;
    $scope.year = (new Date()).getFullYear();
    $scope.filters = {quarter: "-1", year: $scope.year, structure: "-1"};
    var rangeYears = (start, stop, step) => Array.from({length: (stop - start) / step + 1}, (_, i) => start + (i * step));
    $scope.years = rangeYears($scope.year, $scope.year - 5, -1);
    $scope.monitors = [];

    $ocLazyLoad.load('js/services/UIService.js').then(function () {
        var UI = $injector.get('UI');
        UI.nav().then(function (response) {
            var data = response.data;
            $scope.tabs = [];
            for (var i = 0; i < data.nav.left[0].items.length; i++) {
                if (data.nav.left[0].items[i].name === "Monitoring & Evaluation") {
                    for (var j = 0; j < data.nav.left[0].items[i].items.length; j++) {
                        data.nav.left[0].items[i].items[j].name = gettextCatalog.getString(data.nav.left[0].items[i].items[j].name);
                    }
                    $scope.tabs = data.nav.left[0].items[i].items;
                }
            }
        }).catch(function (response) {
            console.error(response);
        });
    });

    $scope.currentTab = 0;

    $scope.label = {
        page: gettextCatalog.getString("Page") + gettextCatalog.getString(":"),
        rowsPerPage: gettextCatalog.getString("Rows per page") + gettextCatalog.getString(":"),
        of: gettextCatalog.getString("of")
    }

    $ocLazyLoad.load('js/services/MonitorService.js').then(function () {
        var Monitor = $injector.get('Monitor');
        $ocLazyLoad.load('js/services/StructureService.js').then(function () {
            var Structure = $injector.get('Structure');
            $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
                var Dictionary = $injector.get('Dictionary');
                Dictionary.jsonList({dictionary: 'time', levels: ['quarters']}).then(function (response) {
                    $scope.quarters = response.data.jsonList;

                    $scope.filterByStructure = function (structureCode) {
                        $scope.staffsFilter = structureCode;
                    };

                    $scope.load = function () {
                        var option = {year: $scope.filters.year, quarter: $scope.filters.quarter, structure: $scope.filters.structure};
                        Monitor.list(option).then(function (response) {
                            var data = response.data;
                            $scope.monitors = data;
                        }).catch(function (response) {
                            console.error(response);
                        });
                    }

                    //Load structure list
                    Structure.list().then(function (response) {
                        var data = response.data;
                        $scope.structures = data;
                        $scope.load();
                    }).catch(function (response) {
                        console.error(response);
                    });

                    $scope.evaluate = function () {
                        $ocLazyLoad.load('js/controllers/monitor/EvaluationCtrl.js').then(function () {
                            $mdDialog.show({
                                controller: 'EvaluationController',
                                templateUrl: '../templates/dialogs/evaluation.html',
                                parent: angular.element(document.body),
                                clickOutsideToClose: true,
                                locals: {
                                    params: {

                                    }
                                }
                            }).then(function (answer) {
                            }, function () {
                            });
                        });
                    }
                });
            });
        });
    });
});
