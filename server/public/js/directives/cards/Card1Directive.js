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
