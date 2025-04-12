angular.module('ExportsCtrl', []).controller('ExportsController', ['$mdDialog', '$scope', 'gettextCatalog', '$rootScope', '$q', '$filter', '$ocLazyLoad', '$injector', '$interval', '$window','$state', '$stateParams', function ($mdDialog, $scope, gettextCatalog, $rootScope, $q, $filter, $ocLazyLoad, $injector, $interval, $window, $state, $stateParams) {
    const MSG_EXPORT_FAILED = 0;
    const MSG_EXPORT_SUCCEDED_NO_TEST = 1;
    const MSG_EXPORT_SUCCEDED = 2;
    const helper = {
        title: gettextCatalog.getString("No export task created yet"),
        icon: "folder_zip"
    };

    $ocLazyLoad.load('js/services/ExportStaffService.js').then(function() {
        const ExportStaff = $injector.get('ExportStaff');
        //Download from email needed
        if ($state.current.name==='home.staffs.export.download' && $stateParams.id){
            $state.transitionTo('home.staffs.export.main');
            ExportStaff.read({id: $stateParams.id}).then(function(response){
                const data = response.data;  
                if (data && data.length>0 ){
                    $scope.downloadExport(data[0]);
                } else {
                    $rootScope.kernel.alerts.push({
                        type: 1,
                        msg: gettextCatalog.getString('ExportStaff job not found, please check it existence.'),
                        priority: 1
                    });
                    $rootScope.kernel.loading = 100;
                }
            }).catch(function(response) {
                console.error(response);
            });
        }

        function getExports(jobIds){
            const jobIdsToInclude = jobIds && jobIds.length>0 ?  jobIds : [];   
            ExportStaff.list({jobIds:jobIdsToInclude}).then(function(response){
                if(response.data.length == 0){
                    $scope.helper = helper;
                } else {
                    $scope.helper = [];
                }
                const data = response.data;  
                $rootScope.kernel.loading = 100
                $scope.exports = data;
            }).catch(function(response) {
                console.error(response);
            });
        }
        getExports();

        $scope.newExport = function() {
            $scope.startDate;
            $scope.endDate;
            $mdDialog.show({
                controller: ['$scope', 'gettextCatalog', '$rootScope', '$q', '$filter', '$ocLazyLoad', '$injector', '$interval', '$window', function($scope, gettextCatalog, $rootScope, $q, $filter, $ocLazyLoad, $injector, $interval, $window) {
                    $rootScope.kernel.loading = 100;
                    $scope.cancel = function() {
                        $mdDialog.hide();
                    };

                    const loadServices = async () => {
                        try {
                            await $ocLazyLoad.load('js/services/DictionaryService.js');
                            await $ocLazyLoad.load('js/services/StructureService.js');
                            const Dictionary = $injector.get('Dictionary');
                            const Structure = $injector.get('Structure');

                            const personnelSituations = await Dictionary.jsonList({ dictionary: 'personnel', levels: ['situations'] });
                            $scope.situations = personnelSituations.data.jsonList;

                            const structureTypes = await Dictionary.jsonList({ dictionary: 'structure', levels: ['types'] });
                            $scope.types = structureTypes.data.jsonList;

                            $scope.filters = {
                                situation: "0",
                                gender: "-",
                                status: "-",
                                staffOnly: true,
                                type: -1,
                            };

                            const structureList = await Structure.minimalList();
                            $scope.structures = structureList.data;

                            $scope.filterByStructure = function(structureCode) {
                                $scope.staffsFilter = structureCode;
                            };

                            const personnelStatus = await Dictionary.jsonList({ dictionary: 'personnel', levels: ['status'] });
                            $scope.status = personnelStatus.data.jsonList;

                            $scope.onlyDirection = function(item) {
                                return item.rank == "2";
                            };

                            $scope.typeOfService = function(item) {
                                return $scope.filters.type != "-1" ? item.type == $scope.filters.type : true;
                            };

                            $scope.onlySubDirection = function(item) {
                                if ($scope.filters.structure && $scope.filters.structure != "-") {
                                    const code = JSON.parse($scope.filters.structure).code;
                                    return item.rank == "3" && item.code.indexOf(code + "-") == 0;
                                }
                                return false;
                            };

                            const watch = {};
                            watch.status = $scope.$watch('filters.status', async function(newval, oldval) {
                                if (newval && oldval && newval != oldval) {
                                    if (newval != "-") {
                                        const grades = await Dictionary.jsonList({ dictionary: 'personnel', levels: ['status', $scope.filters.status, "grades"] });
                                        $scope.grades = grades.data.jsonList;
                                        $scope.filters.grade = "-";

                                        const categories = await Dictionary.jsonList({ dictionary: 'personnel', levels: ['status', $scope.filters.status, "categories"] });
                                        $scope.categories = categories.data.jsonList;
                                        $scope.filters.category = "-";
                                    } else {
                                        $scope.grades = [];
                                        $scope.filters.grade = "-";
                                        $scope.categories = [];
                                        $scope.filters.category = "-";
                                    }
                                } else {
                                    $scope.grades = [];
                                    $scope.categories = [];
                                    if (oldval) {
                                        $scope.filters.grade = "-";
                                        $scope.filters.category = "-";
                                    }
                                }
                            });

                            watch.structure = $scope.$watch('filters.structure', function(newval, oldval) {
                                if (newval && newval != oldval) {
                                    if (newval && newval != "-") {
                                        newval = JSON.parse(newval).code;
                                        $scope.codeStructure = newval + "-";
                                        $scope.codeStructureExport = newval;
                                    } else {
                                        $scope.codeStructure = "-";
                                        $scope.codeStructureExport = "-1";
                                        $scope.filters.subStructure = undefined;
                                    }
                                }
                            });

                            watch.subStructure = $scope.$watch('filters.subStructure', function(newval, oldval) {
                                if (newval) {
                                    if (newval && newval != "-") {
                                        newval = JSON.parse(newval).code;
                                        $scope.codeStructure = newval;
                                        $scope.codeStructureExport = newval;
                                    } else {
                                        $scope.codeStructure = "-";
                                        $scope.codeStructureExport = "-";
                                    }
                                }
                            });

                            $scope.$on('$destroy', function() {
                                watch.structure();
                                watch.subStructure();
                                watch.status();
                            });
                        } catch (error) {
                            console.error(error);
                        }
                    };

                    loadServices();

                    $scope.createExport = function () {
                        $rootScope.kernel.loading = 0;

                        // Validate export title
                        if (!$scope.export || !$scope.export.title) {
                            $rootScope.kernel.alerts.push({
                                type: 1,
                                msg: gettextCatalog.getString('Export task name is required.'),
                                priority: 1
                            });
                            $rootScope.kernel.loading = 100;
                            return;
                        }
                        $scope.filters.codeStructure = $scope.codeStructure;
                        //delete structure and substructure from filters
                        if ($scope.filters.structure && $scope.filters.structure != "-") {
                            $scope.filters.structure = JSON.parse($scope.filters.structure).code+"-";
                        }
                        if ($scope.filters.subStructure && $scope.filters.subStructure != "-") {
                            $scope.filters.subStructure = JSON.parse($scope.filters.subStructure).code;
                        }
                        // Prepare payload from form filters
                        $scope.exportPayload = {
                            name: $scope.export.title,
                            structure: $scope.filters.structure ,
                            staffOnly: !!$scope.filters.staffOnly,

                            filters: $scope.filters
                        };

                        // Create export
                        ExportStaff.create($scope.exportPayload).then(function (response) {
                            $rootScope.kernel.loading = 100;
                            $rootScope.kernel.alerts.push({
                                type: 3,
                                msg: gettextCatalog.getString('The export has been created'),
                                priority: 4
                            });
                            $mdDialog.hide();
                        }).catch(function (error) {
                            $rootScope.kernel.loading = 100;
                            $rootScope.kernel.alerts.push({
                                type: 1,
                                msg: gettextCatalog.getString('An error occurred while creating the export.'),
                                priority: 1
                            });
                            console.error('Export error:', error);
                        });
                    };



                }],
                templateUrl: '../../../../templates/staffs/staff/export.html',
                parent: angular.element(document.body),
                clickOutsideToClose: true,
            }).then(function(answer) {}, function() {});
        };

        $scope.showExport = function(exportJob){
            $mdDialog.show({
                controller: ['$scope', 'gettextCatalog', '$rootScope', '$q', '$filter', '$ocLazyLoad', '$injector', '$interval', '$window', 'exportJob', function ($scope, gettextCatalog, $rootScope, $q, $filter, $ocLazyLoad, $injector, $interval, $window, exportJob) {
                    $rootScope.kernel.loading = 100;
                    $scope.export=exportJob;
                    $scope.cancel = function() {
                        $mdDialog.hide();
                    }
                    $ocLazyLoad.load("js/services/UserService.js").then(function () {
						var User = $injector.get("User");
                        $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
                            var Dictionary = $injector.get('Dictionary');
                            $ocLazyLoad.load('js/services/LaboratoryService.js').then(function () {
                                var Laboratory = $injector.get('Laboratory');
                                if ($window.localStorage.token) {

                                    $scope.export.data.query.groupLabel = ($scope.export.data.query.group === 'laboratory') ? gettextCatalog.getString('Laboratory location') :
                                    (($scope.export.data.query.group ==='patient') ? gettextCatalog.getString('Patient location') :'');


                                    Dictionary.jsonList({
                                        dictionary: 'location',
                                        levels: ['countries', $rootScope.kernel.country]
                                    }).then(function (response) {
                                        var data = response.data;
                                        const statesArray = ($scope.export.data.query.states && $scope.export.data.query.states.length>0) ? $scope.export.data.query.states.split(',') :[];
                                        $scope.export.data.query.statesArray = statesArray.map(state =>{
                                            return data.jsonList.find(itm => itm.id == state);
                                        });
                                    }).catch(function (response) {
                                        console.error(response);
                                    });

                                    Laboratory.getAll().then(function (response) {
                                        var data = response.data;
                                        $scope.export.data.query.laboratoriesArray = $scope.export.data.query.laboratories.map(labId =>{
                                            return data.find(itm => itm._id == labId);
                                        });
                                    }).catch(function (response) {
                                        console.error(response);
                                    });

                                    User.read({id: $scope.export.data.query.actor.id}).then(function (response) {
                                        $rootScope.kernel.loading = 100;
                                        var data = response.data;
                                        $scope.export.data.query.actor.name= `${data.firstname} ${data.lastname}`
                                    }).catch(function (response) {
                                        console.error(response);
                                    });
                                }
                            });
                        });
                    });
                }]
                ,
                templateUrl: '../../templates/data/dialogs/exportInfo.html',
                parent: angular.element(document.body),
                clickOutsideToClose:true,
                locals: {
                    exportJob: exportJob
                }
            }).then(function(answer) {

            }, function() {

            });
        }

        $scope.downloadExport = function (exportJob) {
            $ocLazyLoad.load('node_modules/angular-file-saver/dist/angular-file-saver.bundle.min.js').then(function () {
                var FileSaver = $injector.get('FileSaver');
                $rootScope.kernel.loading = 0;
                $ocLazyLoad.load('js/services/DownloadService.js').then(function () {
                    var Download = $injector.get('Download');
                    Download.start({
                        method: 'GET',
                        url: '/api/exportStaffs/download/' + exportJob._id ,
                        headers: { 'Content-Type': "application/zip" }
                    }).then(function (response) {
                        var deferred = $q.defer();
                        var d = new Blob([response.data], { type: "application/zip" });
                        var filename = 'Admineex_web_';
                        FileSaver.saveAs(d, filename + gettextCatalog.getString('Export') + '_' + exportJob.data.query.exportName + "_" + gettextCatalog.getString('compressed') + '.zip');
                        $rootScope.kernel.loading = 100;
                        deferred.resolve(response.data);
                    }).catch(function (response) {
                        console.error(response);
                    });
                });
            });
        }

        $scope.deleteExport = function (exportJob) {
            var confirm = $mdDialog.confirm()
            .title(gettextCatalog.getString("Delete this export"))
            .textContent(gettextCatalog.getString("Are you sure you want to delete the export") + " : '" + exportJob.data.query.exportName  + "'" + gettextCatalog.getString("?"))
            .ok(gettextCatalog.getString("Delete"))
            .cancel(gettextCatalog.getString("Cancel"));
            $mdDialog.show(confirm).then(function() {
                ExportStaff.delete({ids:[exportJob._id]}).then(function(response){
                    getExports();
                    
                    $rootScope.kernel.alerts.push({
                        type: 3,
                        msg: gettextCatalog.getString('The export has been deleted'),
                        priority: 4
                    });
                    $rootScope.kernel.loading = 100;
                }).catch(function(response) {
                    console.error(response);
                });
            }, function() {
                // Cancel
            });
        }

        const getJoblabel = (lbl)=>{
            if (lbl === 'completed') return gettextCatalog.getString("Completed");
            if (lbl === 'failed') return gettextCatalog.getString("Failed");
            if (lbl === 'running') return gettextCatalog.getString("Running");
            if (lbl === 'pending') return gettextCatalog.getString("Pending");
            return  '';
        }
        $scope.getJobStatus = (job)=>{
            if (job.lastFinishedAt) return getJoblabel('completed');
            if (job.lastFailedAt) return getJoblabel('failed');
            if (job.lockedAt && !job.lastFinishedAt) return getJoblabel('running');
            if (job.nextRunAt && !job.lastRunAt) return getJoblabel('pending');
            return  ''
        }

        $scope.getJobProgressLabel = (job)=>{
            if (job.data.progress === MSG_EXPORT_FAILED) return gettextCatalog.getString('Work failed. The query is not correctly defined');
            if (job.data.progress === MSG_EXPORT_SUCCEDED_NO_TEST) return gettextCatalog.getString('Work completed, no staff selected');
            if (job.data.progress === MSG_EXPORT_SUCCEDED) return gettextCatalog.getString('Work completed with success');
            return  job.data.progress
        }
       
        $scope.getJobColor = (job)=>{
            if (job.lastFinishedAt && job.data.exportSummaries && job.data.exportSummaries.exportedRows === 0 && job.data.exportSummaries.skippedRows === 0) return 'gray';
            if (job.lastFinishedAt && job.data.exportSummaries && job.data.exportSummaries.skippedRows > 0) return 'orange';
            if (job.lastFinishedAt && job.data.exportSummaries && job.data.exportSummaries.skippedRows === 0 && job.data.exportSummaries.exportedRows > 0) return 'green';
            if (job.lastFinishedAt && !job.data.exportSummariesaries) return 'black'; //old version export
            if (job.lastFailedAt) return 'red';
            if (job.lockedAt && !job.lastFinishedAt) return 'orange';
            if (job.nextRunAt && !job.lastRunAt) return '#007bff';
            return  ''
        }


        var socket = io.connect({
            reconnection: true, // Enable reconnection
            reconnectionAttempts: 5, // Number of reconnection attempts
            reconnectionDelay: 1000
        });

        socket.on('jobProgress', function (status) {
            if (status.reload){  //&& (!status.userId || status.userId && status.userId === $rootScope.account.id)){
                getExports();
            } else {
                if ($scope.exports && $scope.exports.length>0){
                    const index = $scope.exports.findIndex(exp => exp["_id"] === status.id);
                    if (index > -1 && $scope.exports[index]){
                        $scope.exports[index].data.percentage=status.percentage
                        $scope.exports[index].data.exportName=status.exportName
                        $scope.exports[index].data.progress=status.progress

                        if (status.staffsCount || status.staffsCount ===0) $scope.exports[index].data.staffsCount=status.staffsCount;
                        if (status.file) $scope.exports[index].data.file=status.file;
                        if (status.fileSize) $scope.exports[index].data.fileSize=status.fileSize;
                        if (status.lastFinishedAt) $scope.exports[index].lastFinishedAt=status.lastFinishedAt;
                        if (status.failedAt) $scope.exports[index].failedAt=status.failedAt;
                        if (status.success) $scope.exports[index].data.success=status.success;

                        if (status.progress  && status.progress.toString().includes("/")){
                            const  progressArray =status.progress.split('/');
                            $scope.exports[index].data.remainingTime= (((progressArray[1]-progressArray[0]) * status.elapsedTimeMs)/progressArray[0]);
                        }

                        if (status.percentage === 100){
                                $rootScope.kernel.alerts.push({
                                type: 1,
                                msg: status.exportName + gettextCatalog.getString(' export completed with success!'),
                                priority: 2
                            });
                        }

                        $scope.$apply();
                    }
                }
            }

        });


        socket.on('disconnect', function (status) {
            for (let index = 0; index < $scope.exports.length; index++) {
                if (!$scope.exports[index].data.success){
                    $scope.exports[index].data.percentage = 0;
                };
            }
            $scope.$apply(); 
        });

        socket.on('reconnect', function(attemptNumber) {
            getExports();
        });
        
        socket.on('reconnect_failed', function() {
            console.error('Failed to reconnect after multiple attempts');
            for (let index = 0; index < $scope.exports.length; index++) {
                if (!$scope.exports[index].data.success){
                    $scope.exports[index].nextRunAt= new Date();
                    delete $scope.exports[index].lastRunAt;
                    delete $scope.exports[index].lockedAt;
                    delete $scope.exports[index].data.remainingTime;
                    delete $scope.exports[index].data.fileSize;
                    delete $scope.exports[index].data.percentage; 
                    $scope.exports[index].data.progress= gettextCatalog.getString('Connexion lost. The export will be replanned.');
                };
            }
            $scope.$apply();
            socket.connect();
            $rootScope.kernel.alerts.push({
                type: 1,
                msg: gettextCatalog.getString('Failed to reconnect after multiple attempts'),
                priority: 2
            });
        });
          

    }).catch(function (response) {
        console.error(response);
        $rootScope.kernel.loading = 100;
        $rootScope.kernel.alerts.push({
            type: 1,
            msg: gettextCatalog.getString('An error occurred, please try again later'),
            priority: 2
        });
    });  
}]);
