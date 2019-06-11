angular.module('MonitorsCtrl', []).controller('MonitorsController', function ($scope, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $mdDialog, $rootScope) {
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
    $scope.filters = {};
    $scope.monitors = [];


    $ocLazyLoad.load('js/services/StructureService.js').then(function () {
        var Structure = $injector.get('Structure');


        $scope.filterByStructure = function (structureCode) {
            $scope.staffsFilter = structureCode;
        };

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


        $scope.$watch('filters.structure', function (newval, oldval) {
            if (newval) {
                newval = JSON.parse(newval).code;
                //getPositions(newval ? newval : "-1", $scope.showOnlyVacancies?"0":"-1");
            }
        });


    });
});
