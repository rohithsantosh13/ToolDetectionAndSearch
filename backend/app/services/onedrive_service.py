"""
OneDrive integration service for storing images in OneDrive instead of local storage
"""

import os
import requests
import json
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()


class OneDriveService:
    """Service for uploading files to OneDrive using Microsoft Graph API"""
    
    def __init__(self):
        self.client_id = os.getenv('AZURE_CLIENT_ID')
        self.client_secret = os.getenv('AZURE_CLIENT_SECRET')
        self.tenant_id = os.getenv('AZURE_TENANT_ID')
        self.access_token = os.getenv('ONEDRIVE_ACCESS_TOKEN')
        self.folder_id = os.getenv('ONEDRIVE_FOLDER_ID')
        self.base_url = "https://graph.microsoft.com/v1.0"
        
        # SharePoint configuration
        self.sharepoint_site_id = "90cf8811-a62e-4db5-82e2-2aa9c2015210"
        self.sharepoint_folder = "ToolDetectionImages"
        
    def upload_file(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """
        Upload file to SharePoint with fallback to local storage
        
        Args:
            file_content: File content as bytes
            filename: Name of the file
            
        Returns:
            Dict containing upload result with file URL and ID
        """
        try:
            # First try SharePoint upload
            sharepoint_result = self._sharepoint_upload(file_content, filename)
            if sharepoint_result.get("success"):
                print(f"✅ File uploaded to SharePoint: {filename}")
                return sharepoint_result
            
            # If SharePoint fails, fallback to local storage
            print(f"⚠️ SharePoint upload failed, falling back to local storage")
            local_result = self._local_fallback_upload(file_content, filename)
            return local_result

        except Exception as e:
            error_msg = f"Upload error: {str(e)}"
            print(error_msg)
            # Try local fallback even on exception
            try:
                return self._local_fallback_upload(file_content, filename)
            except Exception as fallback_error:
                return {
                    "success": False,
                    "error": f"Both SharePoint and local upload failed: {str(e)} | {str(fallback_error)}"
                }

    def _sharepoint_upload(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """
        Upload file to SharePoint site in ToolDetectionImages folder
        """
        try:
            if not self.access_token:
                return {"success": False, "error": "No access token available"}
            
            headers = {
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/octet-stream'
            }
            
            # Upload to SharePoint site in ToolDetectionImages folder
            upload_url = f"{self.base_url}/sites/{self.sharepoint_site_id}/drive/root:/{self.sharepoint_folder}/{filename}:/content"
            
            response = requests.put(upload_url, headers=headers, data=file_content)
            
            if response.status_code in [200, 201]:
                file_data = response.json()
                # Get the download URL for direct access
                download_url = file_data.get('@microsoft.graph.downloadUrl')
                if not download_url:
                    # If no download URL, try to construct one
                    file_id = file_data.get('id')
                    if file_id:
                        download_url = f"{self.base_url}/sites/{self.sharepoint_site_id}/drive/items/{file_id}/content"
                
                return {
                    "success": True,
                    "file_url": file_data.get('webUrl'),
                    "file_id": file_data.get('id'),
                    "filename": filename,
                    "download_url": download_url,
                    "storage_type": "sharepoint"
                }
            else:
                return {
                    "success": False,
                    "error": f"SharePoint upload failed: {response.status_code} - {response.text}"
                }
                
        except Exception as e:
            return {"success": False, "error": f"SharePoint upload error: {str(e)}"}

    def _local_fallback_upload(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """
        Fallback to local storage when SharePoint fails
        """
        try:
            # Ensure uploads directory exists
            uploads_dir = "uploads"
            os.makedirs(uploads_dir, exist_ok=True)
            
            # Save file locally
            local_path = os.path.join(uploads_dir, filename)
            with open(local_path, 'wb') as f:
                f.write(file_content)
            
            return {
                "success": True,
                "file_url": f"/uploads/{filename}",
                "file_id": filename,
                "filename": filename,
                "local_path": local_path,
                "storage_type": "local"
            }
            
        except Exception as e:
            return {"success": False, "error": f"Local upload error: {str(e)}"}

    def _simple_put_upload(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """Try the simplest upload method - PUT to root:/filename:/content"""
        try:
            headers = {
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/octet-stream'
            }

            # Use the colon syntax which works even when root access is limited
            upload_url = f"{self.base_url}/me/drive/root:/{filename}:/content"

            response = requests.put(upload_url, headers=headers, data=file_content)

            if response.status_code in [200, 201]:
                file_data = response.json()
                print(f"SUCCESS: File uploaded via simple PUT method")
                return {
                    "success": True,
                    "file_url": file_data.get('webUrl'),
                    "file_id": file_data.get('id'),
                    "filename": filename,
                    "download_url": file_data.get('@microsoft.graph.downloadUrl')
                }
            else:
                print(f"Simple PUT upload failed: {response.status_code} - {response.text}")
                return {"success": False, "error": f"Simple PUT failed: {response.text}"}

        except Exception as e:
            print(f"Simple PUT upload error: {str(e)}")
            return {"success": False, "error": str(e)}

    def _folder_upload(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """Try upload to specific folder using folder ID"""
        try:
            headers = {
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/octet-stream'
            }

            # Upload to specific folder
            upload_url = f"{self.base_url}/me/drive/items/{self.folder_id}:/{filename}:/content"

            response = requests.put(upload_url, headers=headers, data=file_content)

            if response.status_code in [200, 201]:
                file_data = response.json()
                print(f"SUCCESS: File uploaded to folder")
                return {
                    "success": True,
                    "file_url": file_data.get('webUrl'),
                    "file_id": file_data.get('id'),
                    "filename": filename,
                    "download_url": file_data.get('@microsoft.graph.downloadUrl')
                }
            else:
                print(f"Folder upload failed: {response.status_code} - {response.text}")
                return {"success": False, "error": f"Folder upload failed: {response.text}"}

        except Exception as e:
            print(f"Folder upload error: {str(e)}")
            return {"success": False, "error": str(e)}

    def _special_folder_upload(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """Try upload to special app folder"""
        try:
            headers = {
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/octet-stream'
            }

            # Try using special approot folder (doesn't require full drive access)
            upload_url = f"{self.base_url}/me/drive/special/approot:/{filename}:/content"

            response = requests.put(upload_url, headers=headers, data=file_content)

            if response.status_code in [200, 201]:
                file_data = response.json()
                print(f"SUCCESS: File uploaded to app folder")
                return {
                    "success": True,
                    "file_url": file_data.get('webUrl'),
                    "file_id": file_data.get('id'),
                    "filename": filename,
                    "download_url": file_data.get('@microsoft.graph.downloadUrl')
                }
            else:
                print(f"Special folder upload failed: {response.status_code} - {response.text}")
                return {"success": False, "error": f"Special folder upload failed: {response.text}"}

        except Exception as e:
            print(f"Special folder upload error: {str(e)}")
            return {"success": False, "error": str(e)}

    def _session_upload(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """Try upload session method"""
        try:
            headers = {
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/json'
            }

            # Create upload session using colon syntax
            session_url = f"{self.base_url}/me/drive/root:/{filename}:/createUploadSession"

            session_data = {
                "item": {
                    "@microsoft.graph.conflictBehavior": "rename",
                    "name": filename
                }
            }

            response = requests.post(session_url, headers=headers, json=session_data)

            if response.status_code == 200:
                session_info = response.json()
                upload_url = session_info.get('uploadUrl')

                # Upload file content
                upload_headers = {
                    'Content-Length': str(len(file_content)),
                    'Content-Range': f'bytes 0-{len(file_content)-1}/{len(file_content)}'
                }

                upload_response = requests.put(upload_url, headers=upload_headers, data=file_content)

                if upload_response.status_code in [200, 201]:
                    file_data = upload_response.json()
                    print(f"SUCCESS: File uploaded via session")
                    return {
                        "success": True,
                        "file_url": file_data.get('webUrl'),
                        "file_id": file_data.get('id'),
                        "filename": filename,
                        "download_url": file_data.get('@microsoft.graph.downloadUrl')
                    }
                else:
                    print(f"Session content upload failed: {upload_response.status_code} - {upload_response.text}")
                    return {"success": False, "error": f"Session upload failed: {upload_response.text}"}
            else:
                print(f"Failed to create upload session: {response.status_code} - {response.text}")
                return {"success": False, "error": f"Session creation failed: {response.text}"}

        except Exception as e:
            print(f"Session upload error: {str(e)}")
            return {"success": False, "error": str(e)}

    def get_file_url(self, file_id: str) -> Optional[str]:
        """
        Get the public URL for a file by its OneDrive ID

        Args:
            file_id: OneDrive file ID

        Returns:
            Public URL of the file or None if not found
        """
        try:
            if not self.access_token:
                return None

            headers = {
                'Authorization': f'Bearer {self.access_token}'
            }

            # Get file metadata
            url = f"{self.base_url}/me/drive/items/{file_id}"
            response = requests.get(url, headers=headers)

            if response.status_code == 200:
                file_data = response.json()
                return file_data.get('webUrl')
            else:
                print(f"Failed to get file URL: {response.status_code} - {response.text}")
                return None

        except Exception as e:
            print(f"Error getting file URL: {str(e)}")
            return None

    def delete_file(self, file_id: str) -> bool:
        """
        Delete a file from OneDrive

        Args:
            file_id: OneDrive file ID

        Returns:
            True if successful, False otherwise
        """
        try:
            if not self.access_token:
                return False

            headers = {
                'Authorization': f'Bearer {self.access_token}'
            }

            # Delete file
            url = f"{self.base_url}/me/drive/items/{file_id}"
            response = requests.delete(url, headers=headers)

            if response.status_code == 204:
                return True
            else:
                print(f"Failed to delete file: {response.status_code} - {response.text}")
                return False

        except Exception as e:
            print(f"Error deleting file: {str(e)}")
            return False

    def get_folder_id(self, folder_name: str) -> Optional[str]:
        """
        Get folder ID by name

        Args:
            folder_name: Name of the folder

        Returns:
            Folder ID or None if not found
        """
        try:
            if not self.access_token:
                return None

            headers = {
                'Authorization': f'Bearer {self.access_token}'
            }

            # Try to get folder using path
            url = f"{self.base_url}/me/drive/root:/{folder_name}"
            response = requests.get(url, headers=headers)

            if response.status_code == 200:
                return response.json().get('id')
            return None

        except Exception as e:
            print(f"Error getting folder ID: {str(e)}")
            return None

    def create_folder(self, folder_name: str) -> Optional[str]:
        """
        Create a new folder in OneDrive

        Args:
            folder_name: Name of the folder to create

        Returns:
            Folder ID or None if failed
        """
        try:
            if not self.access_token:
                return None

            headers = {
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/json'
            }

            # Create folder in root
            url = f"{self.base_url}/me/drive/root/children"
            folder_data = {
                "name": folder_name,
                "folder": {},
                "@microsoft.graph.conflictBehavior": "rename"
            }

            response = requests.post(url, headers=headers, json=folder_data)

            if response.status_code == 201:
                return response.json()['id']
            else:
                print(f"Failed to create folder: {response.status_code} - {response.text}")
                return None

        except Exception as e:
            print(f"Error creating folder: {str(e)}")
            return None


# Global instance
onedrive_service = OneDriveService()