import React, { useState, useEffect, useCallback } from 'react';
import TreeView from 'react-accessible-treeview';
import { cloneDeep, get, set } from 'lodash';
import { generateObjectFromSchema, addxpath, getDataxpath, setTreeState, clearxpath, clearId } from '../../../utils';
import { DATA_TYPES } from '../../../constants';
import { generateTreeStructure } from '../../../utils/treeHelper';
import Node from '../../Node';
import HeaderField from '../../HeaderField';

// Number of items to show per page for nodes with many children
const ITEMS_PER_PAGE = 8;

const DataTree = ({
    projectSchema,
    modelName,
    updatedData,
    storedData,
    subtree,
    mode,
    xpath,
    onUpdate,
    onUserChange,
    selectedId,
    showHidden
}) => {
    const [treeData, setTreeData] = useState([]);
    const [originalTree, setOriginalTree] = useState([]);
    // Track pagination state for nodes with many children
    const [paginatedNodes, setPaginatedNodes] = useState({});

    // Handle page change for a paginated node
    const handlePageChange = useCallback((nodeId, direction) => {
        setPaginatedNodes(prev => {
            const nodeState = prev[nodeId] || { page: 0, totalPages: 1 };
            let newPage = nodeState.page;
            
            if (direction === 'next') {
                newPage = Math.min(newPage + 1, nodeState.totalPages - 1);
            } else if (direction === 'prev') {
                newPage = Math.max(newPage - 1, 0);
            }
            
            return {
                ...prev,
                [nodeId]: {
                    ...nodeState,
                    page: newPage
                }
            };
        });
    }, []);

    useEffect(() => {
        const generatedTree = generateTreeStructure(cloneDeep(projectSchema), modelName, {
            'data': updatedData,
            'isOpen': true,
            'hide': !showHidden ?? false,
            'showDataType': false,
            'originalData': storedData,
            'subtree': subtree,
            'mode': mode,
            'xpath': xpath,
            'onTextChange': handleTextChange,
            'onSelectItemChange': handleSelectItemChange,
            'onCheckboxChange': handleCheckboxToggle,
            'onAutocompleteOptionChange': handleAutocompleteChange,
            'onDateTimeChange': handleDateTimeChange,
            'index': selectedId,
            'forceUpdate': false,
        });
        console.log("generated tree is : ", generatedTree);
        console.log("original tree is : ", originalTree);

        setOriginalTree(generatedTree);

        // Create a flat array for all nodes
        const flattenedNodes = [];
        const xpathToIdMap = new Map();
        
        // Add root node with special ID
        const rootId = "root";
        flattenedNodes.push({
            name: modelName,
            children: [],
            id: rootId,
            parent: null,
            metadata: null
        });

        // Recursive function to process nodes
        
        const processNode = (node, parentId) => {
            // Use xpath as ID, but ensure it's a string and handle null/undefined
            const currentId = node.xpath || String(Math.random());
            xpathToIdMap.set(currentId, node);
            
            const treeNode = {
                name: node.name || node.key || "",
                children: [],
                id: currentId,
                parent: parentId,
                metadata: node
            };

            flattenedNodes.push(treeNode);

            // Check if this node has many children that should be paginated
            if (node.children && node.children.length > ITEMS_PER_PAGE) {
                // Initialize pagination state for this node if not already set
                setPaginatedNodes(prev => {
                    if (!prev[currentId]) {
                        const totalPages = Math.ceil(node.children.length / ITEMS_PER_PAGE);
                        return {
                            ...prev,
                            [currentId]: {
                                page: 0,
                                totalPages,
                                totalItems: node.children.length
                            }
                        };
                    }
                    return prev;
                });
                
                // Process only the children for the current page
                const pageIndex = paginatedNodes[currentId]?.page || 0;
                const startIndex = pageIndex * ITEMS_PER_PAGE;
                const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, node.children.length);
                
                const visibleChildren = node.children.slice(startIndex, endIndex);
                
                visibleChildren.forEach(childNode => {
                    const childId = processNode(childNode, currentId);
                    treeNode.children.push(childId);
                });
                
                // Add pagination info to the node's metadata
                if (treeNode.metadata) {
                    treeNode.metadata.pagination = {
                        currentPage: pageIndex,
                        totalPages: Math.ceil(node.children.length / ITEMS_PER_PAGE),
                        totalItems: node.children.length,
                        onPageChange: (direction) => handlePageChange(currentId, direction)
                    };
                }
            } else if (node.children && node.children.length > 0) {
                // For nodes with fewer children, process all of them
                node.children.forEach(childNode => {
                    const childId = processNode(childNode, currentId);
                    treeNode.children.push(childId);
                });
            }

            return currentId;
        };
        
        // Process all top-level nodes
        generatedTree.forEach(node => {
            const nodeId = processNode(node, rootId);
            flattenedNodes[0].children.push(nodeId);
        });
        
        setTreeData(flattenedNodes);
        console.log("tree data after flattening is : ", treeData);
    }, [projectSchema, storedData, updatedData, mode, subtree, xpath, selectedId, showHidden, paginatedNodes, handlePageChange]);
    

    const handleFormUpdate = (xpath, dataxpath, value, validationRes = null) => {
        const updatedObj = cloneDeep(updatedData);
        set(updatedObj, dataxpath, value);
        if (onUpdate) {
            onUpdate(updatedObj);
        }
        if (onUserChange) {
            onUserChange(xpath, value, validationRes, null);
        }
    }

    const handleTextChange = (e, type, xpath, value, dataxpath, validationRes) => {
        if (value === '') {
            value = null;
        }
        if (type === DATA_TYPES.NUMBER) {
            if (value !== null) {
                value = Number(value);
            }
        }
        if (type === DATA_TYPES.STRING || (type === DATA_TYPES.NUMBER && !isNaN(value))) {
            handleFormUpdate(xpath, dataxpath, value, validationRes);
        }
    }

    const handleDateTimeChange = (dataxpath, xpath, value) => {
        handleFormUpdate(xpath, dataxpath, value);
    }

    const handleSelectItemChange = (e, dataxpath, xpath) => {
        const value = e.target.value;
        handleFormUpdate(xpath, dataxpath, value);
    }

    const handleCheckboxToggle = (e, dataxpath, xpath) => {
        const value = e.target.checked;
        handleFormUpdate(xpath, dataxpath, value);
    }

    const handleAutocompleteChange = (e, value, dataxpath, xpath) => {
        handleFormUpdate(xpath, dataxpath, value);
    }

    const onNodeMouseClick = (e, tree, node, level, keyPath) => {
        if (e.currentTarget.attributes['data-remove']) {
            let updatedObj = cloneDeep(updatedData);
            let xpath = e.currentTarget.attributes['data-remove'].value;
            xpath = getDataxpath(updatedObj, xpath);
            const isArray = xpath.endsWith(']');
            if (isArray) {
                let index = parseInt(xpath.substring(xpath.lastIndexOf('[') + 1, xpath.lastIndexOf(']')));
                let parentxpath = xpath.substring(0, xpath.lastIndexOf('['));
                let parentObject = get(updatedObj, parentxpath);
                parentObject.splice(index, 1);
            } else {
                set(updatedObj, xpath, null);
            }
            onUpdate(updatedObj, 'remove');
        } else if (e.currentTarget.attributes['data-add']) {
            let updatedObj = cloneDeep(updatedData);
            let xpath = e.currentTarget.attributes['data-add'].value;
            xpath = getDataxpath(updatedObj, xpath);
            let ref = e.currentTarget.attributes['data-ref'].value;
            const isArray = xpath.endsWith(']');
            let emptyObject = {};
            if (isArray) {
                if ([DATA_TYPES.NUMBER, DATA_TYPES.STRING].includes(ref)) {
                    let parentxpath = xpath.substring(0, xpath.lastIndexOf('['));
                    let parentObject = get(updatedObj, parentxpath);
                    parentObject.push(null)
                } else {
                    ref = ref.split('/');
                    let currentSchema = ref.length === 2 ? projectSchema[ref[1]] : projectSchema[ref[1]][ref[2]];
                    if (currentSchema.hasOwnProperty('enum') && Object.keys(currentSchema).length === 1) {
                        let parentxpath = xpath.substring(0, xpath.lastIndexOf('['));
                        let parentObject = get(updatedObj, parentxpath);
                        parentObject.push(currentSchema.enum[0]);
                    } else {
                        let parentxpath = xpath.substring(0, xpath.lastIndexOf('['));
                        let originalindex = get(storedData, parentxpath) ? get(storedData, parentxpath).length : 0;
                        let parentObject = get(updatedObj, parentxpath);
                        if (!parentObject) {
                            set(updatedObj, parentxpath, []);
                            parentObject = get(updatedObj, parentxpath);
                        }
                        let parentindex = 0;
                        if (parentObject.length > 0) {
                            let propname = Object.keys(parentObject[parentObject.length - 1]).find(key => key.startsWith('xpath_'));
                            let propxpath = parentObject[parentObject.length - 1][propname];
                            parentindex = parseInt(propxpath.substring(propxpath.lastIndexOf('[') + 1, propxpath.lastIndexOf(']'))) + 1;
                        }
                        let max = originalindex > parentindex ? originalindex : parentindex;
                        let additionalProps = JSON.parse(e.currentTarget.attributes['data-prop'].value);
                        emptyObject = generateObjectFromSchema(projectSchema, cloneDeep(currentSchema), additionalProps);
                        emptyObject = addxpath(emptyObject, parentxpath + '[' + max + ']');
                        parentObject.push(emptyObject);
                    }
                }
            } else {
                ref = ref.split('/');
                let currentSchema = ref.length === 2 ? projectSchema[ref[1]] : projectSchema[ref[1]][ref[2]];
                let additionalProps = JSON.parse(e.currentTarget.attributes['data-prop'].value);
                emptyObject = generateObjectFromSchema(projectSchema, cloneDeep(currentSchema), additionalProps);
                emptyObject = addxpath(emptyObject, xpath);
                set(updatedObj, xpath, emptyObject);
            }
            onUpdate(updatedObj, 'add');
        } else if (e.currentTarget.attributes['data-addcopy']) {
            let updatedObj = cloneDeep(updatedData);
            let xpath = e.currentTarget.attributes['data-addcopy'].value;
            xpath = getDataxpath(updatedObj, xpath);
            let ref = e.currentTarget.attributes['data-ref'].value;
            const isArray = xpath.endsWith(']');
            let dupObj = {};
            let storedObj = cloneDeep(get(updatedObj, xpath));
            if (!storedObj) return;
            storedObj = clearxpath(storedObj);
            if (isArray) {
                clearId(storedObj);
                if ([DATA_TYPES.NUMBER, DATA_TYPES.STRING].includes(ref)) {
                    let parentxpath = xpath.substring(0, xpath.lastIndexOf('['));
                    let parentObject = get(updatedObj, parentxpath);
                    parentObject.push(null)
                } else {
                    ref = ref.split('/');
                    let currentSchema = ref.length === 2 ? projectSchema[ref[1]] : projectSchema[ref[1]][ref[2]];
                    if (currentSchema.hasOwnProperty('enum') && Object.keys(currentSchema).length === 1) {
                        let parentxpath = xpath.substring(0, xpath.lastIndexOf('['));
                        let parentObject = get(updatedObj, parentxpath);
                        parentObject.push(currentSchema.enum[0]);
                    } else {
                        let parentxpath = xpath.substring(0, xpath.lastIndexOf('['));
                        let originalindex = get(storedData, parentxpath) ? get(storedData, parentxpath).length : 0;
                        let parentObject = get(updatedObj, parentxpath);
                        if (!parentObject) {
                            set(updatedObj, parentxpath, []);
                            parentObject = get(updatedObj, parentxpath);
                        }
                        let parentindex = 0;
                        if (parentObject.length > 0) {
                            let propname = Object.keys(parentObject[parentObject.length - 1]).find(key => key.startsWith('xpath_'));
                            let propxpath = parentObject[parentObject.length - 1][propname];
                            parentindex = parseInt(propxpath.substring(propxpath.lastIndexOf('[') + 1, propxpath.lastIndexOf(']'))) + 1;
                        }
                        let max = originalindex > parentindex ? originalindex : parentindex;
                        let additionalProps = JSON.parse(e.currentTarget.attributes['data-prop'].value);
                        dupObj = generateObjectFromSchema(projectSchema, cloneDeep(currentSchema), additionalProps, null, storedObj);
                        dupObj = addxpath(dupObj, parentxpath + '[' + max + ']');
                        parentObject.push(dupObj);
                    }
                }
            } else {
                console.error('duplicate on object is not supported')
            }
            onUpdate(updatedObj, 'add');
        } else {
            let xpath = e.currentTarget.attributes;
            if (xpath.hasOwnProperty('data-open')) {
                xpath = xpath['data-open'].value;
                setTreeState(xpath, true);
            } else if (xpath.hasOwnProperty('data-close')) {
                xpath = xpath['data-close'].value;
                setTreeState(xpath, false);
            }
        }
    }

    const onLeafMouseClick = (event, leaf) => {
        const dataxpath = leaf.dataxpath;
        const parentxpath = dataxpath.substring(0, dataxpath.lastIndexOf('['));
        const index = parseInt(dataxpath.substring(dataxpath.lastIndexOf('[') + 1, dataxpath.lastIndexOf(']')));
        let updatedObj = cloneDeep(updatedData);
        const parent = get(updatedObj, parentxpath);
        parent.splice(index, 1);
        set(updatedObj, parentxpath, parent);
        onUpdate(updatedObj, 'remove');
    }

    const nodeRenderer = ({
        element,
        isBranch,
        isExpanded,
        getNodeProps,
        level,
        handleSelect,
        handleExpand
    }) => {
        if (element.id === "root") return null;

        const nodeProps = getNodeProps();
        const originalNode = element.metadata;
        
        // Handle pagination nodes
        if (originalNode && originalNode.isPagination) {
            return (
                <div {...nodeProps} style={{ paddingLeft: `${(level - 1) * 20}px` }}>
                    <div className="pagination-controls">
                        <button 
                            disabled={originalNode.prevPage === 0} 
                            onClick={() => handlePageChange(originalNode.xpath.replace('_pagination', ''), 'prev')}
                        >
                            Previous
                        </button>
                        <span>{originalNode.name}</span>
                        <button 
                            disabled={originalNode.nextPage >= originalNode.totalPages} 
                            onClick={() => handlePageChange(originalNode.xpath.replace('_pagination', ''), 'next')}
                        >
                            Next
                        </button>
                    </div>
                </div>
            );
        }
        
        // Regular nodes handled as before

        // Dynamically determine the component to render
        const Component = originalNode.children && Array.isArray(originalNode.children) ? HeaderField : Node;

        // const handleClick = (e) => {
        //     if (!e.currentTarget) return;
            
        //     handleExpand(e);
            
        //     // Handle data-remove functionality
        //     if (e.currentTarget.attributes['data-remove']) {
        //         let updatedObj = cloneDeep(updatedData);
        //         let xpath = e.currentTarget.attributes['data-remove'].value;
        //         xpath = getDataxpath(updatedObj, xpath);
        //         const isArray = xpath.endsWith(']');
        //         if (isArray) {
        //             let index = parseInt(xpath.substring(xpath.lastIndexOf('[') + 1, xpath.lastIndexOf(']')));
        //             let parentxpath = xpath.substring(0, xpath.lastIndexOf('['));
        //             let parentObject = get(updatedObj, parentxpath);
        //             parentObject.splice(index, 1);
        //         } else {
        //             set(updatedObj, xpath, null);
        //         }
        //         onUpdate(updatedObj, 'remove');
        //         return;
        //     }

        //     // Handle data-add functionality
        //     if (e.currentTarget.attributes['data-add']) {
        //         let updatedObj = cloneDeep(updatedData);
        //         let xpath = e.currentTarget.attributes['data-add'].value;
        //         xpath = getDataxpath(updatedObj, xpath);
        //         console.log("xpath mila:", xpath);
                
        //         let ref = e.currentTarget.attributes['data-ref'].value;

        //         console.log("header field ne bheja ref,",ref);
        //         const schemaPath = ref.split('/');
        //         const schema = schemaPath.length === 2 
        //         ? projectSchema[schemaPath[1]] 
        //         : projectSchema[schemaPath[1]][schemaPath[2]];

        //         const isArray = Array.isArray(get(updatedObj, xpath)) || (schema && schema.type === 'array');

        //         let emptyObject = {};
        //         // eligible_brokers
        //         if (isArray) { 
        //             if ([DATA_TYPES.NUMBER, DATA_TYPES.STRING].includes(ref)) {
        //                 let parentxpath = xpath.substring(0, xpath.lastIndexOf('['));
        //                 let parentObject = get(updatedObj, parentxpath);
        //                 parentObject.push(null);
        //             } else {
        //                 ref = ref.split('/');
        //                 let currentSchema = ref.length === 2 ? projectSchema[ref[1]] : projectSchema[ref[1]][ref[2]];
        //                 if (currentSchema.hasOwnProperty('enum') && Object.keys(currentSchema).length === 1) {
        //                     let parentxpath = xpath.substring(0, xpath.lastIndexOf('['));
        //                     let parentObject = get(updatedObj, parentxpath);
        //                     parentObject.push(currentSchema.enum[0]);
        //                 } else {
        //                     let parentxpath = xpath.substring(0, xpath.lastIndexOf('['));
        //                     let originalindex = get(storedData, parentxpath) ? get(storedData, parentxpath).length : 0;
        //                     let parentObject = get(updatedObj, parentxpath);
        //                     if (!parentObject) {
        //                         set(updatedObj, parentxpath, []);
        //                         parentObject = get(updatedObj, parentxpath);
        //                     }
        //                     let parentindex = 0;
        //                     if (parentObject.length > 0) {
        //                         let propname = Object.keys(parentObject[parentObject.length - 1]).find(key => key.startsWith('xpath_'));
        //                         let propxpath = parentObject[parentObject.length - 1][propname];
        //                         parentindex = parseInt(propxpath.substring(propxpath.lastIndexOf('[') + 1, propxpath.lastIndexOf(']'))) + 1;
        //                     }
        //                     let max = originalindex > parentindex ? originalindex : parentindex;
        //                     let additionalProps = JSON.parse(e.currentTarget.attributes['data-prop'].value);
        //                     emptyObject = generateObjectFromSchema(projectSchema, cloneDeep(currentSchema), additionalProps);
        //                     emptyObject = addxpath(emptyObject, parentxpath + '[' + max + ']');
        //                     parentObject.push(emptyObject);
        //                 }
        //             }
        //         } else {
        //             ref = ref.split('/');
        //             let currentSchema = ref.length === 2 ? projectSchema[ref[1]] : projectSchema[ref[1]][ref[2]];
        //             let additionalProps = JSON.parse(e.currentTarget.attributes['data-prop'].value);
        //             emptyObject = generateObjectFromSchema(projectSchema, cloneDeep(currentSchema), additionalProps);
        //             emptyObject = addxpath(emptyObject, xpath);
        //             set(updatedObj, xpath, emptyObject);
        //         }
        //         onUpdate(updatedObj, 'add');
        //         return;
        //     }

        //     // Handle data-addcopy functionality
        //     if (e.currentTarget.attributes['data-addcopy']) {
        //         let updatedObj = cloneDeep(updatedData);
        //         let xpath = e.currentTarget.attributes['data-addcopy'].value;
        //         xpath = getDataxpath(updatedObj, xpath);
        //         let ref = e.currentTarget.attributes['data-ref'].value;
        //         const isArray = xpath.endsWith(']');
        //         let dupObj = {};
        //         let storedObj = cloneDeep(get(updatedObj, xpath));
        //         if (!storedObj) return;
        //         storedObj = clearxpath(storedObj);
                
        //         if (isArray) {
        //             clearId(storedObj);
        //             if ([DATA_TYPES.NUMBER, DATA_TYPES.STRING].includes(ref)) {
        //                 let parentxpath = xpath.substring(0, xpath.lastIndexOf('['));
        //                 let parentObject = get(updatedObj, parentxpath);
        //                 parentObject.push(null);
        //             } else {
        //                 ref = ref.split('/');
        //                 let currentSchema = ref.length === 2 ? projectSchema[ref[1]] : projectSchema[ref[1]][ref[2]];
        //                 if (currentSchema.hasOwnProperty('enum') && Object.keys(currentSchema).length === 1) {
        //                     let parentxpath = xpath.substring(0, xpath.lastIndexOf('['));
        //                     let parentObject = get(updatedObj, parentxpath);
        //                     parentObject.push(currentSchema.enum[0]);
        //                 } else {
        //                     let parentxpath = xpath.substring(0, xpath.lastIndexOf('['));
        //                     let originalindex = get(storedData, parentxpath) ? get(storedData, parentxpath).length : 0;
        //                     let parentObject = get(updatedObj, parentxpath);
        //                     if (!parentObject) {
        //                         set(updatedObj, parentxpath, []);
        //                         parentObject = get(updatedObj, parentxpath);
        //                     }
        //                     let parentindex = 0;
        //                     if (parentObject.length > 0) {
        //                         let propname = Object.keys(parentObject[parentObject.length - 1]).find(key => key.startsWith('xpath_'));
        //                         let propxpath = parentObject[parentObject.length - 1][propname];
        //                         parentindex = parseInt(propxpath.substring(propxpath.lastIndexOf('[') + 1, propxpath.lastIndexOf(']'))) + 1;
        //                     }
        //                     let max = originalindex > parentindex ? originalindex : parentindex;
        //                     let additionalProps = JSON.parse(e.currentTarget.attributes['data-prop'].value);
        //                     dupObj = generateObjectFromSchema(projectSchema, cloneDeep(currentSchema), additionalProps, null, storedObj);
        //                     dupObj = addxpath(dupObj, parentxpath + '[' + max + ']');
        //                     parentObject.push(dupObj);
        //                 }
        //             }
        //         } else {
        //             console.error('duplicate on object is not supported');
        //         }
        //         onUpdate(updatedObj, 'add');
        //         return;
        //     }

        //     // Handle open/close functionality
        //     let xpath = e.currentTarget.attributes;
        //     if (xpath.hasOwnProperty('data-open')) {
        //         xpath = xpath['data-open'].value;
        //         setTreeState(xpath, true);
        //     } else if (xpath.hasOwnProperty('data-close')) {
        //         xpath = xpath['data-close'].value;
        //         setTreeState(xpath, false);
        //     }
        // };
        

//         const handleClick2 = (e) => {
//     if (!e.currentTarget) return;

//     handleExpand(e);

//     // Helper to get schema and detect array type
//     const getIsArrayFromSchema = (xpath, ref, obj) => {
//         const schemaPath = ref.split('/');
//         const schema = schemaPath.length === 2
//             ? projectSchema[schemaPath[1]]
//             : projectSchema[schemaPath[1]][schemaPath[2]];
//         const dataAtPath = get(obj, xpath);
//         return Array.isArray(dataAtPath) || (schema && schema.type === 'array');
//     };

//     // Handle data-remove
//     if (e.currentTarget.attributes['data-remove']) {
//         let updatedObj = cloneDeep(updatedData);
//         let xpath = e.currentTarget.attributes['data-remove'].value;
//         xpath = getDataxpath(updatedObj, xpath);
//         const isArray = xpath.endsWith(']');
//         if (isArray) {
//             let index = parseInt(xpath.substring(xpath.lastIndexOf('[') + 1, xpath.lastIndexOf(']')));
//             let parentxpath = xpath.substring(0, xpath.lastIndexOf('['));
//             let parentObject = get(updatedObj, parentxpath);
//             parentObject.splice(index, 1);
//         } else {
//             set(updatedObj, xpath, null);
//         }
//         onUpdate(updatedObj, 'remove');
//         return;
//     }

//     // Handle data-add
//     if (e.currentTarget.attributes['data-add']) {
//         let updatedObj = cloneDeep(updatedData);
//         let xpath = e.currentTarget.attributes['data-add'].value;
//         xpath = getDataxpath(updatedObj, xpath);
//         let ref = e.currentTarget.attributes['data-ref'].value;
//         const isArray = getIsArrayFromSchema(xpath, ref, updatedObj);
//         let emptyObject = {};

//         if (isArray) {
//             if (!get(updatedObj, xpath)) {
//                 set(updatedObj, xpath, []);
//             }
//             let parentObject = get(updatedObj, xpath);

//             if ([DATA_TYPES.NUMBER, DATA_TYPES.STRING].includes(ref)) {
//                 parentObject.push(null);
//             } else {
//                 ref = ref.split('/');
//                 let currentSchema = ref.length === 2 ? projectSchema[ref[1]] : projectSchema[ref[1]][ref[2]];

//                 if (currentSchema.hasOwnProperty('enum') && Object.keys(currentSchema).length === 1) {
//                     parentObject.push(currentSchema.enum[0]);
//                 } else {
//                     let originalindex = get(storedData, xpath) ? get(storedData, xpath).length : 0;
//                     let parentindex = 0;
//                     if (parentObject.length > 0) {
//                         let propname = Object.keys(parentObject[parentObject.length - 1]).find(key => key.startsWith('xpath_'));
//                         let propxpath = parentObject[parentObject.length - 1][propname];
//                         parentindex = parseInt(propxpath.substring(propxpath.lastIndexOf('[') + 1, propxpath.lastIndexOf(']'))) + 1;
//                     }
//                     let max = Math.max(originalindex, parentindex);
//                     let additionalProps = JSON.parse(e.currentTarget.attributes['data-prop'].value);
//                     emptyObject = generateObjectFromSchema(projectSchema, cloneDeep(currentSchema), additionalProps);
//                     emptyObject = addxpath(emptyObject, xpath + '[' + max + ']');
//                     parentObject.push(emptyObject);
//                 }
//             }
//         } else {
//             ref = ref.split('/');
//             let currentSchema = ref.length === 2 ? projectSchema[ref[1]] : projectSchema[ref[1]][ref[2]];
//             let additionalProps = JSON.parse(e.currentTarget.attributes['data-prop'].value);
//             emptyObject = generateObjectFromSchema(projectSchema, cloneDeep(currentSchema), additionalProps);
//             emptyObject = addxpath(emptyObject, xpath);
//             set(updatedObj, xpath, emptyObject);
//         }

//         onUpdate(updatedObj, 'add');
//         return;
//     }

//     // Handle data-addcopy
//     if (e.currentTarget.attributes['data-addcopy']) {
//         let updatedObj = cloneDeep(updatedData);
//         let xpath = e.currentTarget.attributes['data-addcopy'].value;
//         xpath = getDataxpath(updatedObj, xpath);
//         let ref = e.currentTarget.attributes['data-ref'].value;
//         const isArray = getIsArrayFromSchema(xpath, ref, updatedObj);
//         let dupObj = {};
//         let storedObj = cloneDeep(get(updatedObj, xpath));
//         if (!storedObj) return;
//         storedObj = clearxpath(storedObj);

//         if (isArray) {
//             clearId(storedObj);
//             if (!get(updatedObj, xpath)) {
//                 set(updatedObj, xpath, []);
//             }
//             let parentObject = get(updatedObj, xpath);

//             if ([DATA_TYPES.NUMBER, DATA_TYPES.STRING].includes(ref)) {
//                 parentObject.push(null);
//             } else {
//                 ref = ref.split('/');
//                 let currentSchema = ref.length === 2 ? projectSchema[ref[1]] : projectSchema[ref[1]][ref[2]];
//                 if (currentSchema.hasOwnProperty('enum') && Object.keys(currentSchema).length === 1) {
//                     parentObject.push(currentSchema.enum[0]);
//                 } else {
//                     let originalindex = get(storedData, xpath) ? get(storedData, xpath).length : 0;
//                     let parentindex = 0;
//                     if (parentObject.length > 0) {
//                         let propname = Object.keys(parentObject[parentObject.length - 1]).find(key => key.startsWith('xpath_'));
//                         let propxpath = parentObject[parentObject.length - 1][propname];
//                         parentindex = parseInt(propxpath.substring(propxpath.lastIndexOf('[') + 1, propxpath.lastIndexOf(']'))) + 1;
//                     }
//                     let max = Math.max(originalindex, parentindex);
//                     let additionalProps = JSON.parse(e.currentTarget.attributes['data-prop'].value);
//                     dupObj = generateObjectFromSchema(projectSchema, cloneDeep(currentSchema), additionalProps, null, storedObj);
//                     dupObj = addxpath(dupObj, xpath + '[' + max + ']');
//                     parentObject.push(dupObj);
//                 }
//             }
//         } else {
//             console.error('duplicate on object is not supported');
//         }

//         onUpdate(updatedObj, 'add');
//         return;
//     }

//     // Handle open/close toggle
//     let xpath = e.currentTarget.attributes;
//     if (xpath.hasOwnProperty('data-open')) {
//         xpath = xpath['data-open'].value;
//         setTreeState(xpath, true);
//     } else if (xpath.hasOwnProperty('data-close')) {
//         xpath = xpath['data-close'].value;
//         setTreeState(xpath, false);
//     }
// };


const handleClick = (e) => {
    if (!e.currentTarget) return;

    handleExpand(e); // expand/collapse tree nodes

    const attrs = e.currentTarget.attributes;

    // --- REMOVE ---
    if (attrs['data-remove']) {
        const xpathAttr = attrs['data-remove'].value;
        const isArrayChild = xpathAttr.endsWith(']');
        if (!isArrayChild) {
            // Prevent remove on container
            return;
        }

        let updatedObj = cloneDeep(updatedData);
        let xpath = getDataxpath(updatedObj, xpathAttr);
        let index = parseInt(xpath.substring(xpath.lastIndexOf('[') + 1, xpath.lastIndexOf(']')));
        let parentxpath = xpath.substring(0, xpath.lastIndexOf('['));
        let parentObject = get(updatedObj, parentxpath);
        parentObject.splice(index, 1);
        onUpdate(updatedObj, 'remove');
        return;
    }

    // --- ADD ---
    if (attrs['data-add']) {
        const xpathAttr = attrs['data-add'].value;
        const isContainer = !xpathAttr.endsWith(']');
        if (!isContainer) {
            // Prevent add on children
            return;
        }

        let updatedObj = cloneDeep(updatedData);
        let xpath = getDataxpath(updatedObj, xpathAttr);
        let ref = attrs['data-ref'].value;
        let emptyObject = {};

        if ([DATA_TYPES.NUMBER, DATA_TYPES.STRING].includes(ref)) {
            let parentObject = get(updatedObj, xpath);
            if (!parentObject) {
                set(updatedObj, xpath, []);
                parentObject = get(updatedObj, xpath);
            }
            parentObject.push(null);
        } else {
            ref = ref.split('/');
            let currentSchema = ref.length === 2 ? projectSchema[ref[1]] : projectSchema[ref[1]][ref[2]];
            let additionalProps = JSON.parse(attrs['data-prop'].value);

            if (currentSchema.hasOwnProperty('enum') && Object.keys(currentSchema).length === 1) {
                let parentObject = get(updatedObj, xpath);
                parentObject.push(currentSchema.enum[0]);
            } else {
                let originalindex = get(storedData, xpath)?.length || 0;
                let parentObject = get(updatedObj, xpath);
                if (!parentObject) {
                    set(updatedObj, xpath, []);
                    parentObject = get(updatedObj, xpath);
                }

                let parentindex = 0;
                if (parentObject.length > 0) {
                    let propname = Object.keys(parentObject[parentObject.length - 1]).find(key => key.startsWith('xpath_'));
                    let propxpath = parentObject[parentObject.length - 1][propname];
                    parentindex = parseInt(propxpath.substring(propxpath.lastIndexOf('[') + 1, propxpath.lastIndexOf(']'))) + 1;
                }

                let max = Math.max(originalindex, parentindex);
                emptyObject = generateObjectFromSchema(projectSchema, cloneDeep(currentSchema), additionalProps);
                emptyObject = addxpath(emptyObject, xpath + `[${max}]`);
                parentObject.push(emptyObject);
            }
        }

        onUpdate(updatedObj, 'add');
        return;
    }

    // --- DUPLICATE ---
    if (attrs['data-addcopy']) {
        const xpathAttr = attrs['data-addcopy'].value;
        const isArrayChild = xpathAttr.endsWith(']');
        if (!isArrayChild) {
            // Prevent duplicate on container
            return;
        }

        let updatedObj = cloneDeep(updatedData);
        let xpath = getDataxpath(updatedObj, xpathAttr);
        let ref = attrs['data-ref'].value;
        let storedObj = cloneDeep(get(updatedObj, xpath));
        if (!storedObj) return;

        storedObj = clearxpath(storedObj);
        clearId(storedObj);

        let parentxpath = xpath.substring(0, xpath.lastIndexOf('['));
        let parentObject = get(updatedObj, parentxpath);
        if (!parentObject) {
            set(updatedObj, parentxpath, []);
            parentObject = get(updatedObj, parentxpath);
        }

        let originalindex = get(storedData, parentxpath)?.length || 0;
        let parentindex = 0;
        if (parentObject.length > 0) {
            let propname = Object.keys(parentObject[parentObject.length - 1]).find(key => key.startsWith('xpath_'));
            let propxpath = parentObject[parentObject.length - 1][propname];
            parentindex = parseInt(propxpath.substring(propxpath.lastIndexOf('[') + 1, propxpath.lastIndexOf(']'))) + 1;
        }

        let max = Math.max(originalindex, parentindex);
        ref = ref.split('/');
        let currentSchema = ref.length === 2 ? projectSchema[ref[1]] : projectSchema[ref[1]][ref[2]];
        let additionalProps = JSON.parse(attrs['data-prop'].value);
        let dupObj = generateObjectFromSchema(projectSchema, cloneDeep(currentSchema), additionalProps, null, storedObj);
        dupObj = addxpath(dupObj, parentxpath + `[${max}]`);
        parentObject.push(dupObj);

        onUpdate(updatedObj, 'add');
        return;
    }

    // --- OPEN/CLOSE TREE STATE ---
    if (attrs['data-open']) {
        setTreeState(attrs['data-open'].value, true);
    } else if (attrs['data-close']) {
        setTreeState(attrs['data-close'].value, false);
    }
};



        return (
            <div 
                {...nodeProps} 
                style={{ paddingLeft: `${(level - 1) * 20}px` }}
                onClick={handleClick}
            >
                <Component 
                    data={{
                        ...originalNode,
                        isOpen: isExpanded
                    }}
                    isOpen={isExpanded}
                    onClick={handleClick}
                />
            </div>
        );
    };

     // Calculate defaultExpandedIds in the render scope, based on current state.
     const calculatedDefaultExpandedIds = React.useMemo(() => {
        const ids = ["root"]; // 1. Always expand the synthetic root node (id: "root")
        
        // 2. Also expand the first actual data node (child of "root")
        if (originalTree && originalTree.length > 0) {
            const firstActualNode = originalTree[0];
            if (firstActualNode && firstActualNode.xpath) {
                ids.push(firstActualNode.xpath);
            }
        }
        return Array.from(new Set(ids)); // Ensure unique IDs
    }, [originalTree]);

    return treeData.length > 0 ? (
        <TreeView
            data={treeData}
            aria-label={modelName}
            nodeRenderer={nodeRenderer}
            expandOnKeyboardSelect
            multiSelect={false}
            disableKeyboardNavigation={false}
            defaultExpandedIds={calculatedDefaultExpandedIds}
        />
    ) : null;
};

export default DataTree;
