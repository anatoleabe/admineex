angular.module('RetiredCtrl', []).controller('RetiredController', function ($scope, $window, $mdDialog, $q, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location, params) {
    //$rootScope.kernel.loading = 0;
    $scope.title = "...";
    $scope.params = params;

    $scope.query = {
        limit: 50,
        page: 1,
        order: "-retirement.notified"
    };

    $scope.helper = {
        title: gettextCatalog.getString("No correspondance retired found"),
    };

    $rootScope.showGlobalView = false;
    $rootScope.retirement = {
        filter: true,
        selectedFilter: 1
    }

    $scope.filters = {
        situation: "0",
        gender: "-",
        status: "-",
    };

    $scope.close = function () {
        $mdDialog.hide();
    }
    $scope.cancel = function () {
        $mdDialog.cancel();
    };


    $ocLazyLoad.load('js/services/StaffService.js').then(function () {
        var Staffs = $injector.get('Staff');
        $scope.getRetired = function () {
            $scope.personnels = undefined;
            $scope.position = $scope.params.position;

            var deferred = $q.defer();

            var filterParams = {
                structure: $scope.codeStructure,
                gender: $scope.filters.gender,
                status: $scope.filters.status,
                grade: $scope.filters.grade,
                category: $scope.filters.category,
                from: $rootScope.range.from.value,
                to: $rootScope.range.to.value,
                retirementState: $rootScope.retirement.selectedFilter
            }

            Staffs.retired({filters: JSON.stringify(filterParams)}).then(function (response) {
                $scope.personnels = response.data;
                $rootScope.kernel.loading = 100;
                deferred.resolve($scope.personnels);
                console.log($scope.personnels)
            }).catch(function (response) {
                console.log(response);
            });
            return deferred.promise;
        }
        $scope.getRetired();
        var watch = {};

        watch.retirementState = $scope.$watch('retirement.selectedFilter', function (newval, oldval) {
            if (newval) {
                $scope.getRetired();
            }
        });

        $scope.$on('$destroy', function () {// in case of destroy, we destroy the watch
            watch.retirementState();
        });

    });



});
