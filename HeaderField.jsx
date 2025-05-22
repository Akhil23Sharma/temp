import React, { useState } from 'react';
import { Typography, Box, ClickAwayListener, Tooltip, IconButton } from "@mui/material";
import { IndeterminateCheckBox, AddBox, AddCircle, RemoveCircle, Menu, LiveHelp, ArrowDropDownSharp, ArrowDropUpSharp, HelpSharp, HelpOutline, Copyright, ContentCopy, AddOutlined, RemoveOutlined, CopyAllOutlined } from "@mui/icons-material";
import { DATA_TYPES, MODES } from '../constants';
import { Icon } from './Icon';
import PropTypes from 'prop-types';
import classes from './HeaderField.module.css';

const HeaderField = (props) => {
    const [showOptions, setShowOptions] = useState(false);

    // const onClick = (e) => {
    //     setShowOptions(false);
    //     props.onClick(e);
    // }
    const onClick = (e) => {
        setShowOptions(false);
        props.onClick(e);
    }

    const onToggle = (val) => {
        if (val) {
            setShowOptions(val);
        } else {
            setShowOptions((show) => !show);
        }
    }

    const title = props.data.title ? props.data.title : props.name;

    let add = false;
    let remove = false;
    if (props.data.mode === MODES.EDIT) {
        if (props.data.type === DATA_TYPES.ARRAY && !props.data['data-remove'] && !props.data.uiUpdateOnly) {
            add = true;
            remove = true;
        }
        if (props.data.type === DATA_TYPES.OBJECT && !props.data.required) {
            if (props.data['object-add']) {
                add = true;
            }
            if (props.data['object-remove']) {
                remove = true;
            }
        }
    }

    return (
        <Box className={classes.container} data-xpath={props.data.xpath}>
            <Box className={classes.header} data-xpath={props.data.xpath} bgcolor='background.nodeHeader'>
            <span className={classes.icon}>
    {props.isOpen ? (
        <ArrowDropUpSharp 
            fontSize='small' 
            data-close={props.data.xpath} 
            onClick={(e) => {
                e.stopPropagation();  // Stop propagation to parent elements
                props.onClick(e);
            }} 
        />
    ) : (
        <ArrowDropDownSharp 
            data-open={props.data.xpath} 
            onClick={(e) => {
                e.stopPropagation();  // Stop propagation to parent elements
                props.onClick(e);
            }} 
        />
    )}
</span>
                <Typography variant="subtitle1" sx={{ display: 'flex', flex: '1' }} >
                    {title}
                </Typography>
                {
                    props.data.help && (
                        <Tooltip title={props.data.help} disableInteractive>
                            <HelpOutline fontSize='small' />
                        </Tooltip>
                    )
                }
            </Box>

            {/* Pagination Controls */}
            {props.data.pagination && props.data.pagination.totalPages > 1 && (
                <Box 
                    className={classes.paginationControls} 
                    sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'flex-end', 
                        padding: '2px 8px', 
                        borderTop: '1px solid rgba(0,0,0,0.1)',
                        backgroundColor: 'rgba(0,0,0,0.02)'
                    }}
                >
                    <IconButton 
                        size="small" 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            props.data.pagination.onPageChange('prev'); 
                        }} 
                        disabled={props.data.pagination.currentPage === 0}
                        sx={{ padding: '2px' }}
                    >
                        <Typography variant="caption" sx={{ fontWeight: 'bold' }}>◄</Typography>
                    </IconButton>
                    <Typography variant="caption" sx={{ margin: '0 8px' }}>
                        {props.data.pagination.currentPage + 1}/{props.data.pagination.totalPages} 
                        ({props.data.pagination.totalItems} items)
                    </Typography>
                    <IconButton 
                        size="small" 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            props.data.pagination.onPageChange('next'); 
                        }} 
                        disabled={props.data.pagination.currentPage >= props.data.pagination.totalPages - 1}
                        sx={{ padding: '2px' }}
                    >
                        <Typography variant="caption" sx={{ fontWeight: 'bold' }}>►</Typography>
                    </IconButton>
                </Box>
            )}

            <HeaderOptions
                add={add}
                remove={remove}
                show={showOptions}
                metadata={props.data}
                onClick={onClick}
                onToggle={onToggle}
            />
        </Box>
    )
}

HeaderField.propTypes = {
    data: PropTypes.object
}

//old headerOptions
// const HeaderOptions = ({ add, remove, show, metadata, onClick, onToggle }) => {
//     const { xpath, ref } = metadata;

//     if (add || remove) {
//         if (show) {
//             return (
//                 <ClickAwayListener onClickAway={() => onToggle(false)}>
//                     <Box className={classes.menu} bgcolor='background.secondary'>
//                         {add && (
//                             <>
//                                 <IconButton
//                                     size='small'
//                                     title='Add'
//                                     data-add={xpath}
//                                     data-ref={ref}
//                                     data-prop={JSON.stringify(metadata)}
//                                     onClick={onClick}>
//                                     <AddOutlined fontSize='small' />
//                                 </IconButton>
//                                 <IconButton
//                                     size='small'
//                                     title='Copy'
//                                     data-addcopy={xpath}
//                                     data-ref={ref}
//                                     data-prop={JSON.stringify(metadata)}
//                                     onClick={onClick}>
//                                     <ContentCopy fontSize='small' />
//                                 </IconButton>
//                             </>
//                         )}
//                         {remove && (
//                             <IconButton
//                                 size='small'
//                                 title='Remove'
//                                 data-remove={xpath}
//                                 onClick={onClick}>
//                                 <RemoveOutlined fontSize='small' />
//                             </IconButton>
//                         )}
//                     </Box>
//                 </ClickAwayListener>
//             )
//         } else {
//             return (
//                 <Box className={classes.option} bgcolor='background.secondary'>
//                     <Icon title="More Options" onClick={onToggle}>
//                         <Menu />
//                     </Icon>
//                 </Box>
//             )
//         }
//     }
// }

const HeaderOptions = ({ add, remove, show, metadata, onClick, onToggle }) => {
    const { xpath, ref } = metadata;

    // Helper to check if xpath points to an array item (child)
    const isChild = xpath.endsWith(']');

    // Determine button visibility based on your rules
    const showAdd = add && !isChild;           // add only on container
    const showCopy = add && isChild;           // duplicate only on child
    const showRemove = remove && isChild;      // remove only on child

    if (showAdd || showCopy || showRemove) {
        if (show) {
            return (
                <ClickAwayListener onClickAway={() => onToggle(false)}>
                    <Box className={classes.menu} bgcolor='background.secondary'>
                        {showAdd && (
                            <IconButton
                                size='small'
                                title='Add'
                                data-add={xpath}
                                data-ref={ref}
                                data-prop={JSON.stringify(metadata)}
                                onClick={onClick}>
                                <AddOutlined fontSize='small' />
                            </IconButton>
                        )}
                        {showCopy && (
                            <IconButton
                                size='small'
                                title='Copy'
                                data-addcopy={xpath}
                                data-ref={ref}
                                data-prop={JSON.stringify(metadata)}
                                onClick={onClick}>
                                <ContentCopy fontSize='small' />
                            </IconButton>
                        )}
                        {showRemove && (
                            <IconButton
                                size='small'
                                title='Remove'
                                data-remove={xpath}
                                onClick={onClick}>
                                <RemoveOutlined fontSize='small' />
                            </IconButton>
                        )}
                    </Box>
                </ClickAwayListener>
            );
        } else {
            return (
                <Box className={classes.option} bgcolor='background.secondary'>
                    <Icon title="More Options" onClick={onToggle}>
                        <Menu />
                    </Icon>
                </Box>
            );
        }
    }

    return null; // No buttons to show
};

export default HeaderField;
