from flask import render_template, redirect, url_for, request, jsonify, flash, send_file
from flask_login import login_user, logout_user, login_required, current_user
import os
from datetime import datetime
from werkzeug.utils import secure_filename
from app import app, db
from models import User, Note, NoteShare, Tag, AIInteraction
from ai_helper import (
    get_note_suggestions, categorize_note, enhance_note, 
    summarize_note, transcribe_audio, suggest_tags, AIModel,
    expand_idea_with_chain, analyze_concept_with_chain,
    generate_related_ideas, create_mind_map_suggestions
)

@app.route('/')
@login_required
def index():
    tag = request.args.get('tag')
    if tag:
        own_notes = Note.query.filter(
            Note.user_id == current_user.id,
            Note.tags.any(name=tag)
        ).order_by(Note.updated_at.desc()).all()
    else:
        own_notes = Note.query.filter_by(
            user_id=current_user.id
        ).order_by(Note.updated_at.desc()).all()
    
    shared_notes = Note.query.join(NoteShare).filter(
        NoteShare.user_id == current_user.id
    ).order_by(Note.updated_at.desc()).all()
    
    user_tags = Tag.query.filter_by(user_id=current_user.id).all()
    return render_template('notes.html', own_notes=own_notes, 
                         shared_notes=shared_notes, user_tags=user_tags,
                         current_tag=tag)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == 'POST':
        user = User.query.filter_by(username=request.form['username']).first()
        if user and user.check_password(request.form['password']):
            login_user(user)
            return redirect(url_for('index'))
        flash('Invalid username or password')
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    if request.method == 'POST':
        user = User()
        user.username = request.form['username']
        user.email = request.form['email']
        user.set_password(request.form['password'])
        db.session.add(user)
        try:
            db.session.commit()
            return redirect(url_for('login'))
        except:
            db.session.rollback()
            flash('Username or email already exists')
    return render_template('register.html')

@app.route('/note/new', methods=['GET', 'POST'])
@login_required
def new_note():
    if request.method == 'POST':
        note = Note()
        note.title = request.form['title']
        note.content = request.form['content']
        note.user_id = current_user.id
        
        tag_names = request.form.getlist('tags[]')
        for tag_name in tag_names:
            tag = Tag.query.filter_by(name=tag_name, user_id=current_user.id).first()
            if not tag:
                tag = Tag(name=tag_name, user_id=current_user.id)
                db.session.add(tag)
            note.tags.append(tag)
        
        db.session.add(note)
        db.session.commit()
        return redirect(url_for('edit_note', id=note.id))
    return render_template('edit_note.html', note=None)

@app.route('/note/<int:id>/edit', methods=['GET', 'POST'])
@login_required
def edit_note(id):
    note = Note.query.get_or_404(id)
    if note.user_id != current_user.id:
        shared = NoteShare.query.filter_by(note_id=id, user_id=current_user.id).first()
        if not shared or not shared.can_edit:
            flash('You do not have permission to edit this note')
            return redirect(url_for('index'))
            
    if request.method == 'POST':
        note.title = request.form['title']
        note.content = request.form['content']
        
        # Update tags
        note.tags.clear()
        tag_names = request.form.getlist('tags[]')
        for tag_name in tag_names:
            tag = Tag.query.filter_by(name=tag_name, user_id=current_user.id).first()
            if not tag:
                tag = Tag(name=tag_name, user_id=current_user.id)
                db.session.add(tag)
            note.tags.append(tag)
            
        db.session.commit()
        return redirect(url_for('index'))
    return render_template('edit_note.html', note=note)

@app.route('/note/<int:id>/delete')
@login_required
def delete_note(id):
    note = Note.query.get_or_404(id)
    if note.user_id != current_user.id:
        flash('You do not have permission to delete this note')
        return redirect(url_for('index'))
    db.session.delete(note)
    db.session.commit()
    return redirect(url_for('index'))

@app.route('/note/<int:id>/share', methods=['GET', 'POST'])
@login_required
def share_note(id):
    note = Note.query.get_or_404(id)
    if note.user_id != current_user.id:
        flash('You do not have permission to share this note')
        return redirect(url_for('index'))
        
    if request.method == 'POST':
        username = request.form['username']
        user = User.query.filter_by(username=username).first()
        if not user:
            flash('User not found')
        elif user.id == current_user.id:
            flash('Cannot share note with yourself')
        else:
            share = NoteShare.query.filter_by(note_id=id, user_id=user.id).first()
            if share:
                flash('Note already shared with this user')
            else:
                share = NoteShare(
                    note_id=id,
                    user_id=user.id,
                    can_edit='can_edit' in request.form
                )
                db.session.add(share)
                db.session.commit()
                flash('Note shared successfully')
                
    shared_with = note.shared_with.all()
    return render_template('share_note.html', note=note, shared_with=shared_with)

@app.route('/note/<int:id>/unshare/<int:user_id>')
@login_required
def unshare_note(id, user_id):
    note = Note.query.get_or_404(id)
    if note.user_id != current_user.id:
        flash('You do not have permission to unshare this note')
        return redirect(url_for('index'))
        
    share = NoteShare.query.filter_by(note_id=id, user_id=user_id).first_or_404()
    db.session.delete(share)
    db.session.commit()
    flash('Note unshared successfully')
    return redirect(url_for('share_note', id=id))

@app.route('/logout')
def logout():
    logout_user()
    return redirect(url_for('login'))

# API Routes
@app.route('/api/transcribe', methods=['POST'])
@login_required
def transcribe_api():
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
            
        audio_file = request.files['audio']
        if not audio_file:
            return jsonify({'error': 'Empty audio file'}), 400
            
        # Validate content type with more lenient checking for Safari
        content_type = audio_file.content_type or ''
        allowed_types = {
            'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/webm', 
            'audio/ogg', 'audio/aac', 'audio/mpeg', 'audio/mp3'
        }
        
        if not any(allowed_type in content_type.lower() for allowed_type in allowed_types):
            return jsonify({'error': f'Unsupported audio format: {content_type}'}), 400
            
        # Save file temporarily with a secure filename
        if audio_file.filename:
            filename = secure_filename(audio_file.filename)
            temp_path = os.path.join('temp_audio', filename)
            os.makedirs('temp_audio', exist_ok=True)
            audio_file.save(temp_path)
            
            try:
                transcribed_text = transcribe_audio(temp_path)
                if not transcribed_text:
                    raise Exception("Failed to transcribe audio")
                    
                return jsonify({
                    'text': transcribed_text,
                    'success': True
                })
            finally:
                # Cleanup temp file
                if os.path.exists(temp_path):
                    os.remove(temp_path)
        else:
            return jsonify({'error': 'Invalid filename'}), 400
                    
    except Exception as e:
        app.logger.error(f"Transcription error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/enhance')
@login_required
def enhance_api():
    content = request.args.get('content', '')
    model = request.args.get('model', AIModel.GPT4O.value)
    try:
        enhanced = enhance_note(content, model)
        return jsonify({'enhanced': enhanced})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/summarize')
@login_required
def summarize_api():
    content = request.args.get('content', '')
    model = request.args.get('model', AIModel.GPT4O.value)
    try:
        summary = summarize_note(content, model)
        return jsonify({'summary': summary})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/expand-idea-chain')
@login_required
def expand_idea_api():
    content = request.args.get('content', '')
    model = request.args.get('model', AIModel.GPT4O.value)
    try:
        result = expand_idea_with_chain(content)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/analyze-concept-chain')
@login_required
def analyze_concept_api():
    content = request.args.get('content', '')
    model = request.args.get('model', AIModel.GPT4O.value)
    try:
        result = analyze_concept_with_chain(content)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/related-ideas')
@login_required
def related_ideas_api():
    content = request.args.get('content', '')
    model = request.args.get('model', AIModel.GPT4O.value)
    try:
        result = generate_related_ideas(content, model)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/mind-map')
@login_required
def mind_map_api():
    content = request.args.get('content', '')
    model = request.args.get('model', AIModel.GPT4O.value)
    try:
        result = create_mind_map_suggestions(content, model)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/suggest-tags')
@login_required
def suggest_tags_api():
    content = request.args.get('content', '')
    model = request.args.get('model', AIModel.GPT4O_MINI.value)
    
    if not content:
        return jsonify({'error': 'No content provided', 'code': 'CONTENT_MISSING'}), 400
    
    if len(content) < 10:
        return jsonify({'error': 'Content too short for meaningful tag suggestions', 'code': 'CONTENT_TOO_SHORT'}), 400
        
    try:
        # Get AI suggested tags with error handling
        try:
            suggested_tags = suggest_tags(content, model)
            if not suggested_tags:
                return jsonify({'error': 'No tags could be generated', 'code': 'NO_TAGS_GENERATED'}), 422
        except Exception as e:
            app.logger.error(f"AI tag suggestion error: {str(e)}")
            return jsonify({'error': 'Failed to generate tags', 'code': 'AI_ERROR'}), 500
        
        # Get user's existing tags
        try:
            existing_tags = Tag.query.filter_by(user_id=current_user.id).all()
            existing_tag_names = set(tag.name.lower() for tag in existing_tags)
        except Exception as e:
            app.logger.error(f"Database query error: {str(e)}")
            return jsonify({'error': 'Failed to fetch existing tags', 'code': 'DB_ERROR'}), 500
        
        # Process and normalize suggested tags with enhanced metadata
        processed_tags = []
        for tag in suggested_tags:
            normalized_tag = tag.lower().strip()
            if normalized_tag:  # Only add non-empty tags
                # Get usage count for existing tags
                usage_count = 0
                if normalized_tag in existing_tag_names:
                    tag_obj = next(t for t in existing_tags if t.name.lower() == normalized_tag)
                    usage_count = len(tag_obj.notes)
                
                processed_tags.append({
                    'name': normalized_tag,
                    'exists': normalized_tag in existing_tag_names,
                    'type': 'existing' if normalized_tag in existing_tag_names else 'new',
                    'usage_count': usage_count,
                    'relevance': 'high' if usage_count > 5 else 'medium' if usage_count > 0 else 'low'
                })
        
        if not processed_tags:
            return jsonify({'error': 'No valid tags after processing', 'code': 'NO_VALID_TAGS'}), 422
        
        # Sort tags by relevance and usage
        processed_tags.sort(key=lambda x: (x['exists'], x['usage_count']), reverse=True)
        
        response_data = {
            'suggestions': processed_tags,
            'total': len(processed_tags),
            'new': sum(1 for tag in processed_tags if not tag['exists']),
            'metadata': {
                'model_used': model,
                'content_length': len(content),
                'existing_tags_total': len(existing_tags),
                'timestamp': datetime.utcnow().isoformat()
            }
        }
        
        # Validate response format
        required_fields = ['suggestions', 'total', 'new', 'metadata']
        if not all(field in response_data for field in required_fields):
            app.logger.error("Invalid response format")
            return jsonify({'error': 'Invalid response format', 'code': 'INVALID_FORMAT'}), 500
            
        return jsonify(response_data)
        
    except Exception as e:
        app.logger.error(f"Error in tag suggestion: {str(e)}")
        return jsonify({
            'error': str(e),
            'code': 'UNKNOWN_ERROR',
            'details': {
                'type': type(e).__name__,
                'message': str(e)
            }
        }), 500
