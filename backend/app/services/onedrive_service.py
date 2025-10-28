"""
OneDrive integration service for storing images in OneDrive instead of local storage
"""

import os
import requests
import json
import time
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
        self.base_url = os.getenv("BASE_URL")
        
        # SharePoint configuration
        self.sharepoint_site_id = os.getenv("SHARE_POINT_SITE_ID")
        self.sharepoint_folder = "ToolDetectionImages"
        
        # Token management
        self.token_expires_at = None
        self._refresh_token_if_needed()
    
    def _refresh_token_if_needed(self):
        """Refresh access token if it's expired or about to expire"""
        try:
            # If we have a static token from env, try to use it first
            if self.access_token and not self._is_token_expired():
                return True
            
            # Try to get a new token using client credentials flow
            return self._get_new_access_token()
            
        except Exception as e:
            print(f"Token refresh error: {e}")
            return False
    
    def _is_token_expired(self) -> bool:
        """Check if the current token is expired"""
        if not self.token_expires_at:
            return True  # Assume expired if we don't know
        
        # Refresh token 5 minutes before it expires
        return time.time() >= (self.token_expires_at - 300)
    
    def _get_new_access_token(self) -> bool:
        """Get a new access token using client credentials flow"""
        try:
            if not all([self.client_id, self.client_secret, self.tenant_id]):
                print("❌ Missing Azure credentials for token refresh")
                return False
            
            # Microsoft Graph token endpoint
            token_url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
            
            # Request body for client credentials flow
            data = {
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'scope': 'https://graph.microsoft.com/.default',
                'grant_type': 'client_credentials'
            }
            
            print("🔄 Refreshing SharePoint access token...")
            response = requests.post(token_url, data=data)
            
            if response.status_code == 200:
                token_data = response.json()
                self.access_token = token_data.get('access_token')
                
                # Calculate expiration time (tokens typically last 1 hour)
                expires_in = token_data.get('expires_in', 3600)
                self.token_expires_at = time.time() + expires_in
                
                print("✅ SharePoint access token refreshed successfully")
                return True
            else:
                print(f"❌ Token refresh failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Error refreshing token: {e}")
            return False
    
    def _make_authenticated_request(self, method: str, url: str, **kwargs) -> requests.Response:
        """Make an authenticated request with automatic token refresh"""
        # Ensure we have a valid token
        if not self._refresh_token_if_needed():
            raise Exception("Unable to get valid access token")
        
        # Add authorization header
        headers = kwargs.get('headers', {})
        headers['Authorization'] = f'Bearer {self.access_token}'
        kwargs['headers'] = headers
        
        # Make the request
        response = requests.request(method, url, **kwargs)
        
        # If we get 401, try refreshing token once
        if response.status_code == 401:
            print("🔄 Received 401, attempting token refresh...")
            if self._get_new_access_token():
                # Retry the request with new token
                headers['Authorization'] = f'Bearer {self.access_token}'
                response = requests.request(method, url, **kwargs)
            else:
                print("❌ Token refresh failed, request will fail")
        
        return response
        
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
            # Ensure we have a valid token
            if not self._refresh_token_if_needed():
                return {"success": False, "error": "Unable to get valid access token"}
            
            headers = {
                'Content-Type': 'application/octet-stream'
            }
            
            # Upload to SharePoint site in ToolDetectionImages folder
            upload_url = f"{self.base_url}/sites/{self.sharepoint_site_id}/drive/root:/{self.sharepoint_folder}/{filename}:/content"
            
            # Use the authenticated request method with automatic token refresh
            response = self._make_authenticated_request('PUT', upload_url, headers=headers, data=file_content)
            
            if response.status_code in [200, 201]:
                file_data = response.json()
                # Get the download URL for direct access
                download_url = file_data.get('@microsoft.graph.downloadUrl')
                if not download_url:
                    # If no download URL, try to construct one
                    file_id = file_data.get('id')
                    if file_id:
                        download_url = f"{self.base_url}/sites/{self.sharepoint_site_id}/drive/items/{file_id}/content"
                
                print(f"✅ SharePoint upload successful: {filename}")
                return {
                    "success": True,
                    "file_url": file_data.get('webUrl'),
                    "file_id": file_data.get('id'),
                    "filename": filename,
                    "download_url": download_url,
                    "storage_type": "sharepoint"
                }
            else:
                error_msg = f"SharePoint upload failed: {response.status_code} - {response.text}"
                print(f"❌ {error_msg}")
                return {
                    "success": False,
                    "error": error_msg
                }
                
        except Exception as e:
            error_msg = f"SharePoint upload error: {str(e)}"
            print(f"❌ {error_msg}")
            return {"success": False, "error": error_msg}

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
            # Get file metadata using authenticated request
            url = f"{self.base_url}/me/drive/items/{file_id}"
            response = self._make_authenticated_request('GET', url)

            if response.status_code == 200:
                file_data = response.json()
                return file_data.get('webUrl')
            else:
                print(f"Failed to get file URL: {response.status_code} - {response.text}")
                return None

        except Exception as e:
            print(f"Error getting file URL: {str(e)}")
            return None

    def get_fresh_download_url(self, file_id: str) -> Optional[str]:
        """
        Get a fresh download URL for a file by its OneDrive ID
        This method fetches a new download URL to avoid token expiration

        Args:
            file_id: OneDrive file ID

        Returns:
            Fresh download URL of the file or None if not found
        """
        try:
            # Get file metadata using authenticated request
            url = f"{self.base_url}/sites/{self.sharepoint_site_id}/drive/items/{file_id}"
            response = self._make_authenticated_request('GET', url)

            if response.status_code == 200:
                file_data = response.json()
                # Get the download URL for direct access
                download_url = file_data.get('@microsoft.graph.downloadUrl')
                if download_url:
                    print(f"✅ Fresh download URL obtained for file: {file_id}")
                    return download_url
                else:
                    print(f"⚠️ No download URL in response for file: {file_id}")
                    return None
            else:
                print(f"❌ Failed to get fresh download URL: {response.status_code} - {response.text}")
                return None

        except Exception as e:
            print(f"❌ Error getting fresh download URL: {str(e)}")
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
            # Delete file using authenticated request
            url = f"{self.base_url}/me/drive/items/{file_id}"
            response = self._make_authenticated_request('DELETE', url)

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