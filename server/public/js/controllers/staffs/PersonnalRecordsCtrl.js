angular.module('PersonnalRecordsCtrl', []).controller('PersonnalRecordsController', function ($scope, $window, gettextCatalog, $q, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location) {
    $rootScope.kernel.loading = 100;
    $scope.title = "...";

    $scope.loading = false;
    $scope.sending = false;
    $scope.search = false;

    $scope.personnels = [];
    $scope.personnelSelected = undefined;
    $scope.personnelSearchText = null;
    $scope.selectedPersonnelChange = null;

    $scope.helper = {
        icon: 'search',
        title: gettextCatalog.getString("Use input to search for a personnal record")
    };

    function sortMe(a, b) {
        return new Date(b.dateOf).getTime() - new Date(a.dateOf).getTime();
    }

    $ocLazyLoad.load('js/services/StaffService.js').then(function () {
        var Staffs = $injector.get('Staff');
        $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
            var Dictionary = $injector.get('Dictionary');

            function createFilterFor(query) {
                var lowercaseQuery = query.toLowerCase();
                return function filterFn(item) {
                    return (item.value.indexOf(lowercaseQuery) === 0);
                };
            }

            //Patient Query search
            $scope.personnelQuerySearch = function (text) {
                $scope.personnelSelected = undefined;
                var deferred = $q.defer();
                var results = text ? createFilterFor(text) : deferred;
                Staffs.search({text: text}).then(function (response) {
                    console.log(response);
                    var result = response.data;
                    if (!result || result === 'null' | result === null) {
                        result = [];
                    }
                    deferred.resolve(result);
                }).catch(function (response) {
                    console.log(response);
                });
                return deferred.promise;
            };

            $scope.selectedPersonnelChange = function (personnel) {
                if (personnel) {
                    $scope.personnelSelected = personnel;
                    //loadsHistory(personnel);
                } else {
                    $scope.personnelSelected = undefined;
                    $scope.events = [];
                }
            }



            loadsHistory = function (personnel) {
                staffFactory.history(personnel).then(function (response) {
                    var p = response.data.personnel;
                    $scope.personnelSelected = p;
                    var history = p.history;
                    var events = [];

                    for (var i = 0; i < history.length; i++) {
                        var h = history[i];

                        var event = {
                            action: h.typeMouvement[0].libelle,
                            title: h.posteActuel[0].nom,
                            content: h.posteActuel[0].structure[0].nom,
                            acte: h.acte[0].nature[0].libelle + " N° " + h.acte[0].numero,
                            dateOf: h.acte[0].dateCreation
                        };
                        events.push(event);
                    }

                    $scope.events = events;

                }).catch(function (response) {
                    console.log(response);
                });
            }
        });
    });
});
