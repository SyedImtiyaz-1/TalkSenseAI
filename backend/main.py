import os
import asyncio
import requests
from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any, List
import boto3
from botocore.exceptions import ClientError
import uuid
from dotenv import load_dotenv
import json
import base64
import time
import websockets
from datetime import datetime
import boto3.session
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from botocore.credentials import Credentials
import aiohttp
import logging
import traceback
import io
from PyPDF2 import PdfReader

# Load environment variables from both backend and root directories
load_dotenv()  # Load from current directory (backend/)
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))  # Load from root directory

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure CORS
FRONTEND_HOST = os.getenv('FRONTEND_HOST', 'http://localhost:5173')
allowed_origins = [
    FRONTEND_HOST,
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure AWS
AWS_REGION = os.getenv('AWS_DEFAULT_REGION', 'us-east-1')
AWS_ACCESS_KEY = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')

# Configure logging for AWS clients
boto3.set_stream_logger('botocore', logging.DEBUG)

# Configure AWS clients with explicit credentials
session = boto3.Session(
    aws_access_key_id=AWS_ACCESS_KEY,
    aws_secret_access_key=AWS_SECRET_KEY,
    region_name=AWS_REGION
)

# S3 client
s3_client = session.client('s3')

# DynamoDB client
dynamodb = session.resource('dynamodb')
conversation_table = dynamodb.Table('CallConversations')

# Configure Amazon Transcribe
transcribe_client = boto3.client(
    'transcribe',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_DEFAULT_REGION')
)

BUCKET_NAME = os.getenv('S3_BUCKET_NAME', 'live-call-insight-db')
KNOWLEDGE_BASE_PREFIX = "knowledge-base/"
RECORDINGS_PREFIX = "recordings/"

# Bedrock config
BEDROCK_MODEL_ID = os.getenv('BEDROCK_MODEL_ID')
BEDROCK_EMBEDDING_MODEL_ID = os.getenv('BEDROCK_EMBEDDING_MODEL_ID')
BEDROCK_KNOWLEDGE_BASE_ID = os.getenv('BEDROCK_KNOWLEDGE_BASE_ID')

# Bedrock client with explicit configuration
bedrock_runtime = session.client(
    service_name='bedrock-runtime',
    region_name=AWS_REGION,
    aws_access_key_id=AWS_ACCESS_KEY,
    aws_secret_access_key=AWS_SECRET_KEY,
)

def extract_text_from_pdf(pdf_content):
    """Extract text from PDF content"""
    try:
        # Create a PDF reader object
        pdf_file = io.BytesIO(pdf_content)
        pdf_reader = PdfReader(pdf_file)
        
        # Extract text from all pages
        text = []
        for page in pdf_reader.pages:
            text.append(page.extract_text())
        
        return "\n".join(text)
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {str(e)}")
        return ""

@app.get("/")
async def root():
    return {"message": "Call Insights API"}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        # Generate a unique filename
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{KNOWLEDGE_BASE_PREFIX}{uuid.uuid4()}{file_extension}"
        
        # Read file content
        file_content = await file.read()
        
        # Upload to S3
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=unique_filename,
            Body=file_content,
            ContentType=file.content_type
        )
        
        # Generate a pre-signed URL for viewing/downloading (valid for 1 hour)
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': BUCKET_NAME, 'Key': unique_filename},
            ExpiresIn=3600
        )
        
        return {
            "message": "File uploaded successfully",
            "filename": unique_filename,
            "url": url
        }
        
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload-audio")
async def upload_audio(file: UploadFile = File(...)):
    try:
        # Generate a unique filename for the audio
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{RECORDINGS_PREFIX}{uuid.uuid4()}{file_extension}"
        
        # Read file content
        file_content = await file.read()
        
        # Upload to S3
        s3_client.put_object(
            Bucket=BUCKET_NAME,
            Key=unique_filename,
            Body=file_content,
            ContentType=file.content_type
        )
        
        return {
            "message": "Audio uploaded successfully",
            "filename": unique_filename
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transcribe")
async def transcribe_audio(request: Dict[str, Any]):
    try:
        audio_key = request.get('audioKey')
        if not audio_key:
            raise HTTPException(status_code=400, detail="Audio key is required")

        # Get the S3 URI for the audio file
        s3_uri = f"s3://{BUCKET_NAME}/{audio_key}"
        
        # Start the transcription job
        job_name = f"transcription_{uuid.uuid4()}"
        response = transcribe_client.start_transcription_job(
            TranscriptionJobName=job_name,
            Media={'MediaFileUri': s3_uri},
            MediaFormat='wav',
            LanguageCode='en-US',
            Settings={
                'ShowSpeakerLabels': True,
                'MaxSpeakerLabels': 2,
            }
        )
        
        # Wait for the transcription job to complete
        while True:
            status = transcribe_client.get_transcription_job(TranscriptionJobName=job_name)
            if status['TranscriptionJob']['TranscriptionJobStatus'] in ['COMPLETED', 'FAILED']:
                break
            await asyncio.sleep(1)  # Wait for 1 second before checking again
            
        if status['TranscriptionJob']['TranscriptionJobStatus'] == 'FAILED':
            raise HTTPException(status_code=500, detail="Transcription failed")
            
        # Get the transcription results
        transcript_uri = status['TranscriptionJob']['Transcript']['TranscriptFileUri']
        transcript_response = requests.get(transcript_uri)
        transcript_data = transcript_response.json()
        
        # Process the results to separate speakers
        items = transcript_data['results']['items']
        speakers = []
        current_speaker = None
        current_text = []
        
        for item in items:
            if 'speaker_label' in item:
                speaker = f"Speaker {item['speaker_label']}"
                if current_speaker and speaker != current_speaker and current_text:
                    speakers.append({
                        'speaker': 'Agent' if current_speaker == 'Speaker 1' else 'Customer',
                        'text': ' '.join(current_text)
                    })
                    current_text = []
                current_speaker = speaker
            
            if 'alternatives' in item and item['alternatives']:
                current_text.append(item['alternatives'][0]['content'])
                
        if current_text:
            speakers.append({
                'speaker': 'Agent' if current_speaker == 'Speaker 1' else 'Customer',
                'text': ' '.join(current_text)
            })
        
        return {
            "message": "Transcription completed successfully",
            "results": speakers
        }
        
    except Exception as e:
        print(f"Transcription error: {str(e)}")  # Debug log
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/delete/{file_id}")
async def delete_file(file_id: str):
    try:
        # Construct the full key with the knowledge-base prefix
        full_key = f"{KNOWLEDGE_BASE_PREFIX}{file_id}"
        print(f"Attempting to delete file with key: {full_key}")  # Debug log
        
        # Try to delete the file directly
        try:
            s3_client.delete_object(
                Bucket=BUCKET_NAME,
                Key=full_key
            )
            print(f"Successfully deleted file: {full_key}")  # Debug log
            return {"message": "File deleted successfully"}
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                raise HTTPException(status_code=404, detail="File not found")
            raise HTTPException(status_code=500, detail=str(e))
            
    except Exception as e:
        print(f"Error deleting file: {str(e)}")  # Debug log
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analysis")
async def get_analysis():
    try:
        print(f"Fetching files from bucket: {BUCKET_NAME}, prefix: {KNOWLEDGE_BASE_PREFIX}")  # Debug log
        print(f"AWS Region: {os.getenv('AWS_DEFAULT_REGION')}")  # Debug log
        print(f"AWS Access Key ID: {os.getenv('AWS_ACCESS_KEY_ID')[:10]}..." if os.getenv('AWS_ACCESS_KEY_ID') else "No AWS_ACCESS_KEY_ID")  # Debug log
        
        # First, let's try to list all buckets to verify connectivity
        try:
            buckets_response = s3_client.list_buckets()
            print(f"Available buckets: {[bucket['Name'] for bucket in buckets_response['Buckets']]}")
        except Exception as bucket_error:
            print(f"Error listing buckets: {bucket_error}")
            raise HTTPException(status_code=500, detail=f"AWS S3 connection error: {str(bucket_error)}")
        
        # Check if our specific bucket exists
        try:
            s3_client.head_bucket(Bucket=BUCKET_NAME)
            print(f"Bucket '{BUCKET_NAME}' exists and is accessible")
        except ClientError as bucket_error:
            error_code = bucket_error.response['Error']['Code']
            if error_code == '404':
                available_buckets = [bucket['Name'] for bucket in s3_client.list_buckets()['Buckets']]
                raise HTTPException(status_code=500, detail=f"Bucket '{BUCKET_NAME}' does not exist. Available buckets: {available_buckets}")
            elif error_code == '403':
                raise HTTPException(status_code=500, detail=f"Access denied to bucket '{BUCKET_NAME}'. Check your AWS permissions.")
            else:
                raise HTTPException(status_code=500, detail=f"Error accessing bucket '{BUCKET_NAME}': {str(bucket_error)}")
        
        # Get all objects in the knowledge_base folder
        response = s3_client.list_objects_v2(
            Bucket=BUCKET_NAME,
            Prefix=KNOWLEDGE_BASE_PREFIX
        )
        
        print("S3 Response:", response)  # Debug log
        
        analysis_data = {
            "totalFiles": 0,
            "totalSize": 0,
            "files": []
        }
        
        if 'Contents' in response:
            for obj in response['Contents']:
                # Skip the folder itself
                if obj['Key'] == KNOWLEDGE_BASE_PREFIX:
                    continue
                    
                analysis_data["totalFiles"] += 1
                analysis_data["totalSize"] += obj['Size']
                
                # Get the original filename without the prefix
                filename = os.path.basename(obj['Key'])
                
                # Generate a pre-signed URL
                url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': BUCKET_NAME, 'Key': obj['Key']},
                    ExpiresIn=3600
                )
                
                analysis_data["files"].append({
                    "id": filename,
                    "name": filename,
                    "size": obj['Size'],
                    "url": url,
                    "lastModified": obj['LastModified'].isoformat()
                })
        
        print("Analysis Data:", analysis_data)  # Debug log
        return analysis_data
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        print(f"AWS ClientError: {error_code} - {error_message}")
        raise HTTPException(status_code=500, detail=f"AWS S3 Error ({error_code}): {error_message}")
    except Exception as e:
        print(f"Unexpected error fetching analysis: {str(e)}")  # Debug log
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

# WebSocket endpoint for real-time transcription
@app.websocket("/ws/transcribe")
async def websocket_transcribe(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connection accepted")
    
    # Create unique conversation ID
    conversation_id = str(uuid.uuid4())
    conversation_data = {
        "id": conversation_id,
        "timestamp": datetime.now().isoformat(),
        "transcript": []
    }

    try:
        # Create a presigned URL for the transcribe streaming API
        aws_session = session  # Use the global boto3 session
        transcribe_client = aws_session.client('transcribe')
        
        # Get credentials for SigV4 signing
        credentials = aws_session.get_credentials()
        creds = credentials.get_frozen_credentials()
        
        # Create a request for the websocket URL
        request = AWSRequest(
            method='GET',
            url=f'wss://transcribestreaming.{AWS_REGION}.amazonaws.com:8443/stream-transcription-websocket',
            params={
                'language-code': 'en-US',
                'media-encoding': 'pcm',
                'sample-rate': '44100'
            }
        )
        
        # Sign the request with SigV4
        auth = SigV4Auth(creds, 'transcribe', AWS_REGION)
        auth.add_auth(request)
        
        # Get the presigned URL
        presigned_url = request.url
        
        logger.info(f"Created presigned URL for Transcribe streaming")
        
        # Create a connection to AWS Transcribe streaming service
        async with aiohttp.ClientSession() as http_session:  # Renamed to http_session
            async with http_session.ws_connect(presigned_url) as aws_ws:
                logger.info("Connected to AWS Transcribe streaming service")
                
                # Start two tasks: one for receiving audio from client and sending to AWS,
                # and another for receiving transcription from AWS and sending to client
                
                # Task 1: Receive audio from client and send to AWS
                async def forward_audio():
                    try:
                        while True:
                            # Process audio data
                            audio_data = await websocket.receive_bytes()
                            
                            # Create the event message for AWS Transcribe
                            message = {
                                "audio_event": {
                                    "audio_chunk": base64.b64encode(audio_data).decode('utf-8')
                                }
                            }
                            
                            await aws_ws.send_json(message)
                    except Exception as e:
                        logger.error(f"Error in forward_audio: {str(e)}")
                        logger.error(traceback.format_exc())
                
                # Task 2: Receive transcription from AWS and send to client
                async def receive_transcription():
                    try:
                        async for msg in aws_ws:
                            if msg.type == aiohttp.WSMsgType.TEXT:
                                data = json.loads(msg.data)
                                logger.debug(f"Received data from AWS: {data}")
                                
                                if 'Transcript' in data.get('TranscriptEvent', {}):
                                    results = data['TranscriptEvent']['Transcript'].get('Results', [])
                                    
                                    for result in results:
                                        alternatives = result.get('Alternatives', [])
                                        if alternatives:
                                            transcript = alternatives[0].get('Transcript', '')
                                            is_final = not result.get('IsPartial', True)

                                            if transcript.strip():
                                                # Send transcript to client (both partial and final)
                                                await websocket.send_json({
                                                    "type": "transcript",
                                                    "data": {
                                                        "text": transcript,
                                                        "is_final": is_final
                                                    }
                                                })
                                                logger.info(f"Sent transcript (is_final={is_final}): {transcript}")

                                                if is_final:
                                                    # Save to conversation data
                                                    conversation_data["transcript"].append({
                                                        "text": transcript,
                                                        "timestamp": datetime.now().isoformat()
                                                    })
                                                    
                                                    # Get AI assistance
                                                    assistance_text = await get_bedrock_assistance(transcript)
                                                    
                                                    # Send assistance to client
                                                    await websocket.send_json({
                                                        "type": "assistance",
                                                        "data": {
                                                            "suggestion": assistance_text
                                                        }
                                                    })
                                                    logger.info(f"Sent assistance: {assistance_text}")
                    except Exception as e:
                        logger.error(f"Error in receive_transcription: {str(e)}")
                        logger.error(traceback.format_exc())
                
                # Run both tasks concurrently
                await asyncio.gather(
                    forward_audio(),
                    receive_transcription()
                )

    except Exception as e:
        error_msg = f"Transcription error: {str(e)}"
        logger.error(error_msg)
        logger.error(traceback.format_exc())
        try:
            await websocket.send_json({"error": error_msg})
        except:
            pass
    finally:
        # Save conversation to DynamoDB
        try:
            if conversation_data["transcript"]:
                conversation_table.put_item(Item={
                    "ConversationId": conversation_id,
                    "Timestamp": conversation_data["timestamp"],
                    "Transcript": conversation_data["transcript"]
                })
                logger.info(f"Saved conversation {conversation_id} to DynamoDB")
        except Exception as e:
            logger.error(f"Error saving to DynamoDB: {str(e)}")

        # Cleanup
        await websocket.close()

async def get_bedrock_assistance(user_message: str) -> str:
    """
    Queries the S3 knowledge base, invokes Bedrock, and returns assistance.
    """
    try:
        # Get relevant documents from S3 knowledge base
        def get_s3_docs():
            response = s3_client.list_objects_v2(
                Bucket=BUCKET_NAME,
                Prefix=KNOWLEDGE_BASE_PREFIX
            )
            
            context_docs = []
            if 'Contents' in response:
                for obj in response['Contents']:
                    if obj['Key'] == KNOWLEDGE_BASE_PREFIX:
                        continue
                    
                    doc_response = s3_client.get_object(
                        Bucket=BUCKET_NAME,
                        Key=obj['Key']
                    )
                    doc_content = doc_response['Body'].read()
                    
                    if obj['Key'].lower().endswith('.pdf'):
                        doc_text = extract_text_from_pdf(doc_content)
                    else:
                        try:
                            doc_text = doc_content.decode('utf-8')
                        except UnicodeDecodeError:
                            logger.warning(f"Could not decode file as text: {obj['Key']}")
                            continue
                    
                    if doc_text.strip():
                        context_docs.append(doc_text)
            return context_docs

        context_docs = await asyncio.to_thread(get_s3_docs)
        
        context = "\n\n".join(context_docs)
        
        if not context.strip():
            return "I apologize, but I couldn't find any readable documents in the knowledge base to help answer your question."

        prompt = f"""You are a helpful AI assistant. Use the following context to answer the question.
        If you cannot find the answer in the context, say so.

        Context:
        {context}

        Question: {user_message}

        Answer:"""

        request_payload = {
            "inputText": prompt,
            "textGenerationConfig": {
                "maxTokenCount": 512,
                "temperature": 0.7,
                "topP": 0.9,
                "stopSequences": []
            }
        }

        def invoke_bedrock():
            return bedrock_runtime.invoke_model(
                modelId=BEDROCK_MODEL_ID,
                body=json.dumps(request_payload),
                accept='application/json',
                contentType='application/json'
            )

        response = await asyncio.to_thread(invoke_bedrock)
        
        response_body = json.loads(response.get('body').read())
        
        if 'results' in response_body and len(response_body['results']) > 0:
            answer = response_body['results'][0].get('outputText', '')
        else:
            answer = "I apologize, but I couldn't generate a proper response at the moment."
        
        return answer

    except ClientError as e:
        error_code = e.response['Error'].get('Code', 'Unknown')
        error_message = e.response['Error'].get('Message', str(e))
        logger.error(f"AWS Error in get_bedrock_assistance ({error_code}): {error_message}")
        return f"An AWS error occurred: {error_message}"
    except Exception as e:
        logger.error(f"Unexpected error in get_bedrock_assistance: {str(e)}")
        logger.error(traceback.format_exc())
        return "An unexpected error occurred while getting assistance."

@app.post("/api/chat")
async def chat_with_knowledge_base(payload: dict = Body(...)):
    """
    Chat endpoint that uses Amazon Titan with context from S3 knowledge base.
    Expects: { "message": "..." }
    Returns: { "response": "..." }
    """
    try:
        user_message = payload.get("message")
        if not user_message:
            raise HTTPException(status_code=400, detail="Missing 'message' in request body")

        response = await get_bedrock_assistance(user_message)
        
        return {"response": response}
            
    except Exception as e:
        logger.error(f"Unexpected error in chat endpoint: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred. Please check the server logs for more details."
        )

@app.get("/api/debug/aws")
async def debug_aws():
    """Debug endpoint to test AWS S3 connectivity"""
    try:
        # Test basic AWS connectivity
        response = s3_client.list_buckets()
        
        debug_info = {
            "aws_region": os.getenv('AWS_DEFAULT_REGION'),
            "configured_bucket": BUCKET_NAME,
            "available_buckets": [bucket['Name'] for bucket in response['Buckets']],
            "bucket_exists": BUCKET_NAME in [bucket['Name'] for bucket in response['Buckets']],
            "aws_access_key_id": os.getenv('AWS_ACCESS_KEY_ID')[:10] + "..." if os.getenv('AWS_ACCESS_KEY_ID') else "Not set"
        }
        
        # If bucket exists, try to access it
        if debug_info["bucket_exists"]:
            try:
                s3_client.head_bucket(Bucket=BUCKET_NAME)
                debug_info["bucket_accessible"] = True
                
                # Try to list objects
                objects_response = s3_client.list_objects_v2(Bucket=BUCKET_NAME, MaxKeys=5)
                debug_info["sample_objects"] = [obj['Key'] for obj in objects_response.get('Contents', [])]
                
            except ClientError as e:
                debug_info["bucket_accessible"] = False
                debug_info["bucket_error"] = str(e)
        
        return debug_info
        
    except Exception as e:
        return {"error": str(e), "aws_credentials_set": bool(os.getenv('AWS_ACCESS_KEY_ID'))}

@app.get("/api/debug/config")
async def debug_config():
    """Debug endpoint to check AWS configuration"""
    return {
        "aws_region": AWS_REGION,
        "aws_access_key_present": bool(AWS_ACCESS_KEY),
        "aws_secret_key_present": bool(AWS_SECRET_KEY),
        "bedrock_model_id": BEDROCK_MODEL_ID,
        "knowledge_base_id": BEDROCK_KNOWLEDGE_BASE_ID,
        "s3_bucket": BUCKET_NAME
    }

@app.get("/api/knowledge-base")
async def list_knowledge_base():
    """List all documents in the knowledge base"""
    try:
        response = s3_client.list_objects_v2(
            Bucket=BUCKET_NAME,
            Prefix=KNOWLEDGE_BASE_PREFIX
        )
        
        documents = []
        if 'Contents' in response:
            for obj in response['Contents']:
                if obj['Key'] == KNOWLEDGE_BASE_PREFIX:  # Skip the folder itself
                    continue
                
                # Generate a pre-signed URL for viewing/downloading
                url = s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': BUCKET_NAME, 'Key': obj['Key']},
                    ExpiresIn=3600  # URL valid for 1 hour
                )
                
                documents.append({
                    'id': os.path.basename(obj['Key']),
                    'name': os.path.basename(obj['Key']),
                    'size': obj['Size'],
                    'lastModified': obj['LastModified'].isoformat(),
                    'url': url
                })
        
        return {
            "total": len(documents),
            "documents": documents
        }
        
    except ClientError as e:
        error_code = e.response['Error'].get('Code', 'Unknown')
        error_message = e.response['Error'].get('Message', str(e))
        logger.error(f"AWS Error ({error_code}): {error_message}")
        
        if error_code == 'AccessDenied':
            raise HTTPException(
                status_code=403,
                detail="Access denied to S3 bucket. Please check your AWS credentials and permissions."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"AWS error: {error_message}"
            )
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while listing knowledge base documents."
        )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv('PORT', 8000))
    host = os.getenv('HOST', '0.0.0.0')
    uvicorn.run(app, host=host, port=port)