angular.module('PhysicalRecordCtrl', []).controller('PhysicalRecordController', function ($scope, $window, $mdDialog, $q, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location, params) {
    //$rootScope.kernel.loading = 0;
    $scope.title = "...";
    var doc = params && params.doc ? params.doc : $stateParams.doc;
    var selectedPersonal = params && params.p ? params.p : $stateParams.p;

    $scope.params = params;

    $scope.document = {
        category: "",
        issueDate: "",
        owner: undefined,
        ownerType: "personal",
        date: true,
        reference: undefined,
        keyWords: [],
        creation: undefined,
        modification: undefined,
        fileName: undefined,
        fullPath: undefined,
        index: 0//Default index value for sortings
    };

    $scope.uploader = {};

    $scope.loading = true;
    $rootScope.kernel.loading = 0
    $scope.personnels = [];
    $scope.types = [];
    $scope.natturesActe = [];
    $scope.searchTerm = "";

    $scope.stopPropagation = function (event) {
        event.stopPropagation();
    };

    $scope.personnelSelected = undefined;
    $scope.personnelSearchText = null;
    $scope.selectedPersonnelChange = null;
    $scope.selectedPersonnel = null;

    $scope.close = function () {
        $mdDialog.hide();
    }
    $scope.cancel = function () {
        $mdDialog.cancel();
    };

    $ocLazyLoad.load('node_modules/ng-file-upload/dist/ng-file-upload.min.js').then(function () {
        var Upload = $injector.get('Upload');
        $ocLazyLoad.load('js/services/DictionaryService.js').then(function () {
            var Dictionary = $injector.get('Dictionary');

            Dictionary.jsonList({dictionary: 'structure', levels: ['types']}).then(function (response) {
                $scope.types = response.data.jsonList;
                Dictionary.jsonList({dictionary: 'structure', levels: ['ranks']}).then(function (response) {
                    $scope.ranks = response.data.jsonList;
                    Dictionary.jsonList({dictionary: 'personnel', levels: ['mouvements']}).then(function (response) {
                        $scope.mouvements = response.data.jsonList;
                        Dictionary.jsonList({dictionary: 'document', levels: ['categories']}).then(function (response) {
                            $scope.categories = response.data.jsonList;
                            $ocLazyLoad.load('js/services/StructureService.js').then(function () {
                                var Structure = $injector.get('Structure');
                                $ocLazyLoad.load('js/services/StaffService.js').then(function () {
                                    var Staff = $injector.get('Staff');
                                    if (selectedPersonal) {
                                        $scope.personnels = [selectedPersonal];
                                    } else {
                                        Staff.list({minify: true, limit: 0, skip: 0, search: $scope.staffsFilter, filters: JSON.stringify()}).then(function (response) {
                                            $scope.personnels = response.data.data;
                                        }).catch(function (response) {
                                            console.log(response);
                                        });
                                    }


                                    $scope.loadStructures = function (type) {
                                        $scope.loading = true;
                                        $rootScope.kernel.loading = 0;
                                        $scope.structures = undefined;
                                        $scope.structures = undefined;
                                        $scope.affectation.positionId = undefined
                                        var option = {type: "t=" + type + "=r=" + 2};
                                        if (type == 2) {
                                            option = {type: "t=" + type + "=r=" + 2};
                                        }

                                        Structure.minimalList(option).then(function (response) {
                                            var data = response.data;
                                            $scope.structures = data;
                                            $scope.loading = false;
                                            $rootScope.kernel.loading = 100;
                                            if ($scope.params && $scope.params.positionTo) {
                                                $scope.structure = $scope.params.positionTo.structure.father.code;
                                            }

                                        }).catch(function (response) {
                                            console.error(response);
                                        });
                                    }

                                    $scope.loadSubStructures = function (type, structureCode) {
                                        $scope.loading = true;
                                        $rootScope.kernel.loading = 0;
                                        $scope.substructures = undefined;
                                        $scope.affectation.positionId = undefined
                                        var option = {type: "t=" + type};
                                        if (type == 2) {
                                            option = {type: "t=" + type + "=r=" + 3};
                                        }



                                        Structure.minimalList(option).then(function (response) {
                                            var data = response.data;
                                            $scope.substructures = data;

                                            $scope.substructures.sort(function (a, b) {
                                                if (a.code < b.code) {
                                                    return -1;
                                                }
                                                if (a.code > b.code) {
                                                    return 1;
                                                }
                                                return 0;
                                            });

                                            var groupOfCodes = [];
                                            $scope.groupList = $scope.substructures.reduce(function (previous, current) {
                                                var father = {};
                                                if (current.rank == "3" && current.code.indexOf($scope.structure + "-") == 0) {

                                                    if ((current.code.indexOf('-1') !== current.code.lastIndexOf('-1') || (current.code.indexOf($scope.structure + '-') === 0 && current.code.indexOf('-1') === current.code.lastIndexOf('-1'))) && //Les codes qui ??
                                                            current.code.lastIndexOf('-1') != -1 && // '-1' existe dans le code ou la première occurence du préfixe d'un code
                                                            groupOfCodes.indexOf(current.code.substring(0, current.code.lastIndexOf('-1'))) === -1) { // Eviter les doublons de groupe

                                                        var code = current.code.substring(0, current.code.lastIndexOf('-1'));

                                                        if (($scope.typeStructre !== "1" && code !== $scope.structure) || $scope.structure + '-1' === current.code || $scope.typeStructre === "1") {//Remove the main father to avoid duplication
                                                            father = {
                                                                name: current.name,
                                                                code: code
                                                            }
                                                            groupOfCodes.push(current.code.substring(0, current.code.lastIndexOf('-1')));
                                                            previous.push(father);
                                                        }

                                                    } else {
                                                        if ($scope.structure + '-1' === current.code) {
                                                            father = {
                                                                name: current.name,
                                                                code: current.code.substring(0, current.code.lastIndexOf('-1'))
                                                            }
                                                            groupOfCodes.push(current.code.substring(0, current.code.lastIndexOf('-1')));
                                                            previous.push(father);
                                                        }
                                                    }
                                                }
                                                previous.sort(function (a, b) {
                                                    if (a.name < b.name) {
                                                        return -1;
                                                    }
                                                    if (a.name > b.name) {
                                                        return 1;
                                                    }
                                                    return 0;
                                                })
                                                return previous;
                                            }, []);

                                            $scope.loading = false;
                                            $rootScope.kernel.loading = 100

                                            if ($scope.params && $scope.params.positionTo) {
                                                $scope.substructure = $scope.params.positionTo.structure.code;
                                            }

                                        }).catch(function (response) {
                                            console.error(response);
                                        });
                                    }


                                    $scope.onlySubDirection = function (item) {
                                        if ($scope.structure) {
                                            var code = $scope.structure;
                                            return item.rank == "3" && item.code.indexOf(code + "-") == 0;
                                        } else {
                                            return false;
                                        }
                                    };



                                    var watch = {};
                                    watch.file = $scope.$watch('uploader.file', function (newval, oldval) {

                                        if (newval) {
                                            var initialName = newval.name;

                                            $scope.uploader.file.name = initialName;
                                            $scope.document.fileName = initialName;
                                        }
                                    });
                                    $scope.$on('$destroy', function () {// in case of destroy, we destroy the watch
                                        watch.file();
                                    });
                                    console.log(selectedPersonal);
                                    if (selectedPersonal) {
                                        $scope.document.owner = selectedPersonal._id;
                                        $scope.selectedPersonal = selectedPersonal;
                                    }

                                    if (doc !== undefined) {//edit mode
                                        $scope.document = doc;
                                        delete $scope.document.$$hashKey;
                                        delete $scope.document.actor;
                                        //delete $scope.document.categoryBeautified;
                                        //delete $scope.document.fname;
                                        delete $scope.document.metainfo;
                                        delete $scope.document.personnel;

                                        $rootScope.kernel.loading = 100;
                                        // add edit an Document
                                    } else {//Create mode
                                        // add edit an Document
                                    }

                                    $scope.submit = function () {
                                        $rootScope.kernel.loading = 0;
                                        if ($scope.uploader && $scope.uploader.file && $scope.uploader.file.name) {
                                            $scope.document.fileName = $scope.uploader.file.name;
                                        }
                                        $scope.document.keyWordsLength = $scope.document.keyWords.length
                                        if ($scope.document.ownerType === "dgtcfm"){
                                            $scope.document.owner = "dgtcfm"
                                        }
                                        
                                        if ($scope.document.category != undefined && $scope.document.owner != undefined && $scope.document.ownerType != undefined && $scope.document.reference != undefined && $scope.document.fileName != undefined) {
                                            Upload.upload({
                                                url: '/api/documents',
                                                file: $scope.uploader,
                                                fields: $scope.document,
                                                method: 'PUT',
                                                sendObjectsAsJsonBlob: true
                                            }).then(function (response) {
                                                $state.transitionTo('home.staffs.physicalrecords');
                                                $rootScope.kernel.alerts.push({
                                                    type: 3,
                                                    msg: gettextCatalog.getString('The document has been saved'),
                                                    priority: 4
                                                });
                                                $rootScope.kernel.loading = 100;
                                                $scope.close();
                                            }).catch(function (response) {
                                                $rootScope.kernel.loading = 100;
                                                $rootScope.kernel.alerts.push({
                                                    type: 1,
                                                    msg: gettextCatalog.getString('An error occurred, please try again later'),
                                                    priority: 2
                                                });
                                                console.error(response);
                                            });
                                        } else {
                                            $rootScope.kernel.loading = 100;
                                            $rootScope.kernel.alerts.push({
                                                type: 2,
                                                msg: gettextCatalog.getString("Please fill all required fields"),
                                                priority: 3
                                            });
                                        }
                                    }


                                });
                            });
                        });
                    });
                });
            });
        });

    });
});
