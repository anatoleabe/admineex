angular.module('Card1Directive', []).directive('card1', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'A',
        scope: {},
        templateUrl: 'templates/statistics/directives/card1.html',
        link: function ($scope, $element, $attrs) {
            $scope.loadingChart = true;

            $ocLazyLoad.load('js/services/ChartService.js').then(function () {
                var Chart = $injector.get('Chart');
                function build() {
                    $scope.loadingChart = true;
                    Chart.build({
                        name : 'global'
                    }).then(function (response) {
                        console.log(response)
                        $scope.loadingChart = false;
                        $scope.data = [
                            response.data.totalStaff,
                            response.data.totalCorpsTresor,
                            response.data.totalStaff - response.data.totalCorpsTresor - response.data.totalNonFonctionnaire, //Autre
                            response.data.totalNonFonctionnaire,
                            response.data.totalPostesVacants,
                            response.data.totalMen,
                            response.data.totalWomen,
                            Math.round((response.data.totalCorpsTresor * 100) / (response.data.totalStaff)),
                            Math.round(((response.data.totalStaff - response.data.totalCorpsTresor - response.data.totalNonFonctionnaire) * 100) / (response.data.totalStaff)),
                            Math.round((response.data.totalNonFonctionnaire * 100) / (response.data.totalStaff)),
                            response.data.structures,
                            response.data.positions,
                        ];
                    }).catch(function (response) {
                        console.log(response);
                        $rootScope.kernel.alerts.push({
                            type: 1,
                            msg: gettextCatalog.getString('An error occurred, please try again later'),
                            priority: 2
                        });
                    });
                }
                
                $scope.export = function(){
                    var data = [];
                    data.push({category: gettextCatalog.getString("Total number"), value1: $scope.data[0], value2:""});
                    data.push({category: gettextCatalog.getString("Corps of Treasury"), value1: $scope.data[1], value2:$scope.data[7]+"%"});
                    data.push({category: gettextCatalog.getString("Other civil servant"), value1: $scope.data[2], value2:$scope.data[8]+"%"});
                    data.push({category: gettextCatalog.getString("Non-staff personnel"), value1: $scope.data[3], value2:$scope.data[9]+"%"});
                    data.push({category: gettextCatalog.getString("Male/Female ratio"), value1: $scope.data[5]+"/"+$scope.data[6], value2:"-"});
                    data.push({category: gettextCatalog.getString("Number of structures"), value1: $scope.data[10], value2:"-"});
                    data.push({category: gettextCatalog.getString("Number of positions"), value1: $scope.data[11], value2:"-"});
                    return { 
                        title: gettextCatalog.getString("Global statistics"),
                        fields:["category","value1", "value2"],
                        fieldNames:[gettextCatalog.getString("Category"), gettextCatalog.getString("Effective"), gettextCatalog.getString("%")],
                        data: data
                    };
                }
                $rootScope.$watch('selectedStructure', function (newval, oldval) {
                    if (newval) {

                        //console.log("Changement card 1");
                    }
                });
                build();
            });
        }
    };
});
