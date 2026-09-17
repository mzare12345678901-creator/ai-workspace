from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import UserRegister, UserOut, Token
from app.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=Token)
def register(data: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(400, "این نام کاربری قبلاً ثبت شده")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "این ایمیل قبلاً ثبت شده")

    is_first_user = db.query(User).count() == 0

    user = User(
        username=data.username,
        email=data.email,
        hashed_password=hash_password(data.password),
        is_admin=is_first_user,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, user=UserOut.from_orm(user))


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "نام کاربری یا رمز عبور اشتباه است")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "حساب شما غیرفعال است")
    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, user=UserOut.from_orm(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user