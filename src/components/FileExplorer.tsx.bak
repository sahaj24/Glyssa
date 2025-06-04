import React, { useState } from 'react';

// Define types for our file structure
interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileItem[];
  expanded?: boolean;
}

interface FileExplorerProps {
  initialFiles?: FileItem[];
  onFileSelect: (filePath: string) => void;
}

// A simple default with just one file to start with
const DEFAULT_FILES: FileItem[] = [
  {
    name: 'my-project',
    path: '/my-project',
    isDirectory: true,
    expanded: true,
    children: [
      {
        name: 'main.js',
        path: '/my-project/main.js',
        isDirectory: false,
      }
    ]
  }
];

export const FileExplorer: React.FC<FileExplorerProps> = ({ 
  initialFiles = DEFAULT_FILES,
  onFileSelect 
}) => {
  const [files, setFiles] = useState<FileItem[]>(initialFiles);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileParentPath, setNewFileParentPath] = useState('');
  const [isDirectory, setIsDirectory] = useState(false);

  const toggleFolder = (targetPath: string) => {
    const updateExpanded = (items: FileItem[]): FileItem[] => {
      return items.map(item => {
        if (item.path === targetPath) {
          return { ...item, expanded: !item.expanded };
        }
        if (item.children) {
          return { ...item, children: updateExpanded(item.children) };
        }
        return item;
      });
    };
    
    setFiles(updateExpanded(files));
  };

  const handleFileClick = (path: string) => {
    if (onFileSelect) {
      // Make sure we pass the full path to properly select the file
      console.log('FileExplorer: Selecting file', path);
      onFileSelect(path);
    }
  };

  // Handle right-click on file/folder to show context menu
  const handleContextMenu = (e: React.MouseEvent, filePath: string, isDir: boolean) => {
    e.preventDefault();
    setNewFileParentPath(isDir ? filePath : getParentPath(filePath));
    setShowNewFileModal(true);
  };

  // Get parent path from file path
  const getParentPath = (filePath: string): string => {
    const parts = filePath.split('/');
    parts.pop();
    return parts.join('/');
  };

  // Create a new file or folder
  const handleCreateNewFile = () => {
    if (!newFileName.trim()) {
      setShowNewFileModal(false);
      return;
    }

    const newPath = `${newFileParentPath}/${newFileName}`;
    const newItem: FileItem = {
      name: newFileName,
      path: newPath,
      isDirectory: isDirectory,
      children: isDirectory ? [] : undefined,
      expanded: isDirectory ? true : undefined
    };

    // Update file structure by adding new file/folder
    const updateFileStructure = (items: FileItem[]): FileItem[] => {
      return items.map(item => {
        if (item.path === newFileParentPath) {
          return {
            ...item,
            expanded: true,
            children: [...(item.children || []), newItem]
          };
        }
        if (item.children) {
          return {
            ...item,
            children: updateFileStructure(item.children)
          };
        }
        return item;
      });
    };

    setFiles(updateFileStructure(files));
    setShowNewFileModal(false);
    setNewFileName('');
    setIsDirectory(false);

    // If it's a file, select it
    if (!isDirectory) {
      setSelectedFile(newPath);
      onFileSelect(newPath);
    }
  };

  // Recursive component for file tree
  const FileTreeItem = ({ item }: { item: FileItem }) => {
    const isActive = selectedFile === item.path;
    
    return (
      <div>
        <div 
          className={`flex items-center px-2 py-1 cursor-pointer group hover:bg-zinc-700/50 ${isActive ? 'bg-zinc-800' : ''}`}
          onClick={() => item.isDirectory ? toggleFolder(item.path) : handleFileClick(item.path)}
          onContextMenu={(e) => handleContextMenu(e, item.path, item.isDirectory)}
        >
          {item.isDirectory && (
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-3.5 w-3.5 text-zinc-500 mr-1 transform transition-transform ${item.expanded ? 'rotate-90' : 'rotate-0'}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          )}
          
          {!item.isDirectory && (
            <div className="w-3.5 h-3.5 mr-1"></div>
          )}
          
          <div className="w-4 h-4 mr-1.5 flex-shrink-0">
            {item.isDirectory ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-full h-full text-zinc-500" fill="currentColor">
                <path d="M19.5 20.5h-15A2.47 2.47 0 012 18.07V5.93A2.47 2.47 0 014.5 3.5h4.6a1 1 0 01.77.37l2.6 3.18h7A2.47 2.47 0 0122 9.48v8.59a2.47 2.47 0 01-2.5 2.43z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-full h-full text-zinc-500" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
          </div>
          
          <span className="text-sm text-zinc-300">{item.name}</span>
        </div>
        
        {item.isDirectory && item.expanded && item.children && (
          <div className="ml-4">
            {item.children.map((child, index) => (
              <FileTreeItem key={index} item={child} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto py-1 relative">
      {files.map((item, index) => (
        <FileTreeItem key={index} item={item} />
      ))}
      
      {/* Add file button */}
      <button 
        className="absolute bottom-4 right-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full w-10 h-10 flex items-center justify-center shadow-lg"
        onClick={() => {
          setNewFileParentPath(files[0].path);
          setShowNewFileModal(true);
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 3a1 1 0 00-1 1v5H4a1 1 0 100 2h5v5a1 1 0 102 0v-5h5a1 1 0 100-2h-5V4a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      </button>

      {/* New file modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-zinc-800 rounded-lg p-6 w-96 shadow-xl">
            <h3 className="text-lg font-medium text-white mb-4">Create New {isDirectory ? 'Folder' : 'File'}</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-400 mb-1">Name</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder={isDirectory ? 'folder-name' : 'file-name.js'}
                autoFocus
              />
            </div>
            
            <div className="mb-6">
              <label className="inline-flex items-center">
                <input 
                  type="checkbox" 
                  className="form-checkbox h-4 w-4 text-indigo-600 transition duration-150 ease-in-out"
                  checked={isDirectory}
                  onChange={(e) => setIsDirectory(e.target.checked)}
                />
                <span className="ml-2 text-sm text-zinc-400">Create as folder</span>
              </label>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button 
                className="px-4 py-2 bg-zinc-700 text-white rounded hover:bg-zinc-600 focus:outline-none"
                onClick={() => setShowNewFileModal(false)}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500 focus:outline-none"
                onClick={handleCreateNewFile}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileExplorer;
