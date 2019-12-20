angular.module('StructuresCtrl', []).controller('StructuresController', function ($scope, $state, $window, gettextCatalog, $ocLazyLoad, $injector, $mdDialog, $rootScope, $q, $http) {
    console.log("hshahahah")
    $ocLazyLoad.load('js/services/StructureService.js').then(function () {
        var Structure = $injector.get('Structure');
        var helper = {
            title: gettextCatalog.getString("No structure"),
            icon: "account_balance"
        };

        $scope.organizations = [], $scope.helper = [];
        $scope.search = false;
        $scope.filters = {};
        $scope.query = {
            limit: 25,
            page: 1,
            order: "code"
        };

        $scope.edit = function (params) {
            if ($rootScope.account.role == '1' || $rootScope.account.role == '3' || $rootScope.account.role == '4') {
                $state.go("home.administration.structures.edit", params);
            }
        };

        function getStructures(id) {
            var limit = $scope.query.limit;
            var skip = $scope.query.limit * ($scope.query.page - 1);
            $scope.helper = [];
            Structure.list({id: id, limit: limit, skip: skip}).then(function (response) {
                var data = response.data;
                if (data.length == 0 && $scope.helper.length == 0) {
                    $scope.helper = helper;
                }
                
                $scope.structures = {
                    data: response.data.data,
                    count: response.data.count
                };
                console.log($scope.structures)
                $rootScope.kernel.loading = 100;
            }).catch(function (response) {
                console.error(response);
            });
        }
        getStructures("-1");


        function deleteStructures(id) {
            Structure.delete({
                id: id
            }).then(function (response) {
                getStructures("-1");
                $rootScope.kernel.alerts.push({
                    type: 3,
                    msg: gettextCatalog.getString('The organization has been deleted'),
                    priority: 4
                });
            }).catch(function (response) {
                console.error(response);
            });
        }

        $scope.load = function () {
            //var structureCode = $scope.filters.subStructure ? JSON.parse($scope.filters.subStructure).code : ($scope.filters.structure ? JSON.parse($scope.filters.structure).code : "-1");
            getStructures("-1");
        };

        $scope.openPdf = function () {
            $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                var FileSaver = $injector.get('FileSaver');
                $rootScope.kernel.loading = 0;
                var deferred = $q.defer();
                $scope.promise = deferred.promise;

                $http({
                    method: 'GET',
                    url: '/api/export/pdf/structures/',
                    headers: {'Content-Type': "application/pdf"},
                    responseType: "arraybuffer"
                }).then(function (response) {
                    var d = new Blob([response.data], {type: "application/pdf"});
                    FileSaver.saveAs(d, 'List_of_structures_dgtcfm.pdf');
                    $rootScope.kernel.loading = 100;
                    deferred.resolve(response.data);
                }).catch(function (response) {
                    console.error(response);
                });
            });

        };

        $scope.onlyDirection = function (item) {
            return item.rank == "2";
        };

        $scope.resetForm = function () {
            $scope.filters.structure = undefined;
            $scope.filters.soustructure = undefined;
            $scope.structureFilter = "";
            getStructures("-1");
        };

        $scope.onlySubDirection = function (item) {
            if ($scope.filters.structure) {
                var code = JSON.parse($scope.filters.structure).code;
                return item.rank == "3" && item.code.indexOf(code + "-") == 0;
            } else {
                return false;
            }

        };

        $scope.$watch('structureFilter', function (newval, oldval) {
            if (newval) {
                getStructures(newval ? newval : "-1");
            }
        });

        $scope.$watch('filters.structure', function (newval, oldval) {
            if (newval) {
                newval = JSON.parse(newval).code;
                if (newval != undefined && newval != "undefined") {
                    $scope.structureFilter = newval + "-";
                } else {
                    $scope.structureFilter = "";
                }
            }
        });

        //Load structure list
        Structure.minimalList().then(function (response) {
            var data = response.data;
            if (data.length == 0 && $scope.helper.length == 0) {
                $scope.helper = helper;
            }
            $scope.structuresDropDown = data;
        }).catch(function (response) {
            console.error(response);
        });

        $scope.showConfirm = function (organization) {
            var confirm = $mdDialog.confirm()
                    .title(gettextCatalog.getString("Delete this organization"))
                    .textContent(gettextCatalog.getString("Are you sure you want to delete the organization") + " " + organization.name + gettextCatalog.getString("?"))
                    .ok(gettextCatalog.getString("OK"))
                    .cancel(gettextCatalog.getString("Cancel"));

            $mdDialog.show(confirm).then(function () {
                // Delete
                deleteStructure(organization._id)
            }, function () {
                // Cancel
            });
        }
    });
});
