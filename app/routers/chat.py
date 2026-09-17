from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Conversation, Message, UploadedFile, User
from app.schemas import ChatRequest, ChatResponse, MessageOut, ConversationOut
from app.ai_gateway import ai_gateway
from app.agent import agent
from app.auth import get_current_user

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.get("/conversations", response_model=List[ConversationOut])
def list_conversations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Conversation).filter(Conversation.user_id == user.id)\
             .order_by(Conversation.created_at.desc()).all()


@router.post("/conversations", response_model=ConversationOut)
def new_conversation(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = Conversation(user_id=user.id, title="گفتگوی جدید")
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/conversations/{cid}/messages", response_model=List[MessageOut])
def get_messages(cid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == cid, Conversation.user_id == user.id).first()
    if not conv:
        raise HTTPException(404, "گفتگو یافت نشد")
    return conv.messages


@router.delete("/conversations/{cid}")
def delete_conversation(cid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == cid, Conversation.user_id == user.id).first()
    if not conv:
        raise HTTPException(404, "گفتگو یافت نشد")
    db.delete(conv)
    db.commit()
    return {"ok": True}


@router.post("/send", response_model=ChatResponse)
async def send_message(req: ChatRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.conversation_id:
        conv = db.query(Conversation).filter(
            Conversation.id == req.conversation_id,
            Conversation.user_id == user.id
        ).first()
        if not conv:
            raise HTTPException(404, "گفتگو یافت نشد")
    else:
        title = req.message[:40] + ("..." if len(req.message) > 40 else "")
        conv = Conversation(user_id=user.id, title=title or "گفتگوی جدید")
        db.add(conv)
        db.commit()
        db.refresh(conv)

    extra_context = ""
    if req.file_ids:
        files = db.query(UploadedFile).filter(
            UploadedFile.id.in_(req.file_ids),
            UploadedFile.user_id == user.id
        ).all()
        for f in files:
            try:
                text = open(f.stored_path, "r", encoding="utf-8", errors="ignore").read()[:4000]
                extra_context += f"\n\n[محتوای فایل {f.filename}]:\n{text}"
            except Exception:
                extra_context += f"\n\n[فایل {f.filename} آپلود شد]"

    db.add(Message(conversation_id=conv.id, role="user", content=req.message))
    db.commit()

    history = [{"role": m.role, "content": m.content}
               for m in conv.messages if m.role in ("user", "assistant")]
    if extra_context and history:
        history[-1]["content"] += extra_context

    reply = await ai_gateway.chat(history)
    db.add(Message(conversation_id=conv.id, role="assistant", content=reply))
    db.commit()
    return ChatResponse(conversation_id=conv.id, reply=reply)


@router.get("/agent-state")
def agent_state(q: str = ""):
    return agent.state(q)