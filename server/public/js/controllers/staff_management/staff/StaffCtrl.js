angular.module('StaffCtrl', []).controller('StaffController', function($scope, $window, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location) {
    $rootScope.kernel.loading = 0;
    $scope.title = "...";
    alert("Staff person to add");
    $ocLazyLoad.load('js/services/DictionaryService.js').then(function() {
        var Dictionary = $injector.get('Dictionary');
        console.log('we are in person management');
        Dictionary.jsonList({dictionary: 'project', levels: ['countries']}).then(function (response) {
            console.log(response);
            $scope.countriesList = response.data.jsonList;
            $ocLazyLoad.load('js/services/UserService.js').then(function() {
                var User = $injector.get('User');
               
            });
        }).catch(function(response) {
            console.error(response);
        });
    });
});
/*app.controller("StaffCtrl", ['$scope', '$http', '$location', '$ocLazyLoad', '$injector', '$rootScope', '$state', '$mdToast', '$q', '$timeout', 'utilsFactory', 'structureFactory', 'gettextCatalog', function ($scope, $http, $location, $ocLazyLoad, $injector, $rootScope, $state, $mdToast, $q, $timeout, utilsFactory, structureFactory, gettextCatalog) {
    var currentId = undefined;
    $scope.title = "...";
    $scope.personnel = {
        nom: "",
        code: "",
        idPere: "",
        idRangStructure: "",
        idTypeStructure: "",
        idDepartement: ""
    };
alert("Staff person to add");
    $scope.loading = false;
    $scope.sending = false;
    $scope.regions = [];
    $scope.divisions = [];
    $scope.types = [];
    $scope.rangs = [];
    $scope.peres = [];

    $scope.searchTerm = "";

    $scope.stopPropagation = function (event) {
        event.stopPropagation();
    };


    $scope.addNewDiplomeLine = function () {
        $scope.diplomes.push({intitule: '', anneeObtention: '', organisation: '', titre: '', });
    }

    $scope.removeDiplomeLine = function (index) {
        $scope.diplomes.splice(index, 1);
    }


    function getRegions() {
        utilsFactory.getRegions().then(function (response) {
            $scope.regions = response.data.data;
        }).catch(function (response) {
            console.log(response);
        });
    }

    function getTypesStructure() {
        utilsFactory.loadList("typeStructure").then(function (response) {
            $scope.types = response.data.elements;
        }).catch(function (response) {
            console.log(response);
        });
    }

    function getRangs() {
        utilsFactory.loadList("rangStructure").then(function (response) {
            $scope.rangs = response.data.elements;
        }).catch(function (response) {
            console.log(response);
        });
    }

    
    $scope.$watch('structure.idRangStructure', function (newval, oldval) {
        if (newval) {
            console.log(newval)
            structureFactory.getStructureByRang(newval-1).then(function (response) {
                $scope.peres = response.data.structures;
            }).catch(function (response) {
                console.log(response);
            });
        } else {
            $scope.peres = [];
            $scope.structure.idRangStructure = undefined;
        }
    });


    //fill country list and set the default
    $scope.$watch('structure.region', function (newval, oldval) {
        if (newval) {
            $scope.structure.idDepartement = undefined;
            getDivisions(newval);
        } else {
            $scope.departements = [];
            $scope.structure.idDepartement = undefined;
        }
    });

    function getDivisions(idRegion) {
        utilsFactory.getDivisions({'idRegion': idRegion}).then(function (response) {
            $scope.divisions = response.data.departements;
        }).catch(function (response) {
            console.log(response);
        });

    }

    $scope.goToRef = function (ref) {
        $location.path(ref).replace();
    }

    $rootScope.$watch('kernel.alerts', function (newValue, oldValue) {
        if (newValue.length > 0) {
            var hide = 3000;
            if (newValue[newValue.length - 1].priority < 3) {
                hide = 5000;
            }
            $mdToast.show(
                    $mdToast.simple()
                    .textContent(newValue[newValue.length - 1].msg)
                    .position('bottom right')
                    .hideDelay(hide)
                    );
            $rootScope.kernel.alerts.splice(-1, 1);
        }
    }, true);

    getRegions();
    getTypesStructure();
    getRangs();

    // Modify or Add ?
    if (currentId !== undefined) {
        $scope.new = false;


    } else {
        $scope.new = true;
        $scope.title = 'Nouveau';
        // Add a new contact
        $scope.submit = function () {
            if ($scope.structure.nom !== undefined) {
                $rootScope.kernel.loading = 0;
                $scope.structure.dateEnregistrement = new Date();
                $scope.structure.miseajour = new Date();
                structureFactory.create($scope.structure).then(function (response) {
                    $rootScope.kernel.loading = 100;
                    $rootScope.kernel.alerts.push({
                        type: 3,
                        msg: gettextCatalog.getString('The structure has been created'),
                        priority: 4
                    });
                    if (response.data && response.data.success == true) {
                        $location.path("/structures").replace();
                    }
                }).catch(function (response) {
                    $rootScope.kernel.loading = 100;
                    $rootScope.kernel.alerts.push({
                        type: 1,
                        msg: gettextCatalog.getString('An error occurred, please try again later'),
                        priority: 2
                    });
                });
            } else {
                $rootScope.kernel.alerts.push({
                    type: 2,
                    msg: gettextCatalog.getString("Please fill all required fields"),
                    priority: 3
                });
            }
        }
    }



}]);*/
